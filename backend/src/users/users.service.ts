import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import * as bcrypt from "bcryptjs";
import { CreateUserDto } from "./dto/create-user.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
      orderBy: { name: "asc" },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
    });
  }

  async createUser(dto: CreateUserDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.prisma.user.create({
        data: {
          name: dto.name.trim(),
          email: dto.email.trim().toLowerCase(),
          passwordHash,
          role: dto.role,
        },
        select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
      });
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
        throw new BadRequestException("Este e-mail já está cadastrado no sistema.");
      }
      throw error;
    }
  }

  async deleteUser(id: string, currentUserId?: string) {
    if (currentUserId && id === currentUserId) {
      throw new BadRequestException("Você não pode excluir o seu próprio usuário logado.");
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const user = await tx.user.findUnique({
            where: { id },
            select: { id: true, role: true },
          });
          if (!user) {
            throw new NotFoundException("Usuário não encontrado.");
          }
          if (user.role === UserRole.ADMIN) {
            throw new BadRequestException(
              "Administradores não podem ser removidos. Apenas usuários do cargo Consultor Comercial podem ser excluídos.",
            );
          }

          const mapping = await tx.userMapping.findUnique({ where: { cuid: id } });
          await tx.lead.updateMany({
            where: {
              OR: [
                { assignedToId_legacy: id },
                ...(mapping ? [{ assignedToId: mapping.uuid }] : []),
              ],
            },
            data: { assignedToId: null, assignedToId_legacy: null },
          });
          await tx.leadInteraction.updateMany({
            where: { userId_legacy: id },
            data: { userId_legacy: null },
          });
          if (mapping) {
            await tx.userMapping.delete({ where: { cuid: id } });
          }

          return tx.user.delete({
            where: { id },
            select: { id: true, name: true, email: true, role: true, createdAt: true, updatedAt: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (typeof error === "object" && error && "code" in error && error.code === "P2034") {
        throw new BadRequestException(
          "A lista de administradores foi alterada simultaneamente. Atualize a tela e tente novamente.",
        );
      }
      throw error;
    }
  }
}
