import { randomUUID } from "crypto";
import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLeadInteractionDto } from "./dto/create-lead-interaction.dto";

@Injectable()
export class LeadInteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLead(leadId: string) {
    await this.ensureLead(leadId);
    return this.prisma.leadInteraction.findMany({
      where: { leadId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(leadId: string, dto: CreateLeadInteractionDto, authenticatedUserId: string) {
    await this.ensureLead(leadId);
    const profileId = await this.resolveAuthenticatedProfile(authenticatedUserId);
    const updateData: Prisma.LeadUpdateInput = {
      lastContactAt: new Date(),
    };

    if (dto.nextActionAt) {
      updateData.nextActionAt = dto.nextActionAt;
    }

    return this.prisma.$transaction(async (tx) => {
      const interaction = await tx.leadInteraction.create({
        data: {
          leadId,
          userId: profileId,
          type: dto.type,
          description: dto.description,
        },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      if (dto.newStatus) {
        await tx.lead.update({
          where: { id: leadId },
          data: { ...updateData, status: dto.newStatus },
        });
      } else {
        const advanced = await tx.lead.updateMany({
          where: { id: leadId, status: { in: [LeadStatus.NEW, LeadStatus.NO_CONTACT] } },
          data: { lastContactAt: new Date(), status: LeadStatus.CONTACTED },
        });
        if (advanced.count === 0) {
          await tx.lead.update({ where: { id: leadId }, data: updateData });
        }
      }

      return interaction;
    });
  }

  private async resolveAuthenticatedProfile(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Usuário autenticado não encontrado");

    return this.prisma.$transaction(async (tx) => {
      const profile = await tx.profile.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role },
        create: { id: randomUUID(), name: user.name, email: user.email, role: user.role },
      });
      await tx.userMapping.upsert({
        where: { cuid: user.id },
        update: { uuid: profile.id, email: user.email },
        create: { cuid: user.id, uuid: profile.id, email: user.email },
      });
      return profile.id;
    });
  }

  private async ensureLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead não encontrado");
  }
}
