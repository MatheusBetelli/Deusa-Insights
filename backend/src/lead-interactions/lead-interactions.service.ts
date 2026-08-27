import { randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LeadAccessActor, scopeLeadWhere } from "../common/lead-access.policy";
import { CreateLeadInteractionDto } from "./dto/create-lead-interaction.dto";

const B2B_LINK_SENT_INTERACTION_TYPE = "B2B_LINK_SENT";

@Injectable()
export class LeadInteractionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByLead(leadId: string, actor: LeadAccessActor) {
    await this.ensureLeadAccess(leadId, actor);
    return this.prisma.leadInteraction.findMany({
      where: { leadId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async create(leadId: string, dto: CreateLeadInteractionDto, actor: LeadAccessActor) {
    const newStatus =
      dto.newStatus ??
      (dto.type === B2B_LINK_SENT_INTERACTION_TYPE ? LeadStatus.LINK_B2B_SENT : undefined);

    if (newStatus === LeadStatus.CONVERTED) {
      throw new BadRequestException(
        "Status CONVERTED é reservado para confirmação via B2B/ERP ou importação oficial de clientes.",
      );
    }

    const updateData: Prisma.LeadUpdateInput = {
      lastContactAt: new Date(),
    };

    if (dto.nextActionAt) {
      updateData.nextActionAt = dto.nextActionAt;
    }

    return this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: scopeLeadWhere({ id: leadId }, actor),
        select: { id: true, status: true },
      });
      if (!lead) throw new NotFoundException("Lead não encontrado");
      if (lead.status === LeadStatus.CONVERTED && newStatus !== undefined) {
        throw new BadRequestException(
          "Cliente Deusa confirmado não pode ter status alterado por ação comercial manual.",
        );
      }
      const profileId = await this.resolveAuthenticatedProfile(tx, actor.sub);

      const interaction = await tx.leadInteraction.create({
        data: {
          leadId,
          userId: profileId,
          type: dto.type,
          description: dto.description,
        },
        include: { user: { select: { id: true, name: true, email: true, role: true } } },
      });

      if (newStatus) {
        const updated = await tx.lead.updateMany({
          where: scopeLeadWhere({ id: leadId }, actor),
          data: { ...updateData, status: newStatus },
        });
        if (updated.count !== 1) throw new NotFoundException("Lead não encontrado");
      } else {
        const advanced = await tx.lead.updateMany({
          where: scopeLeadWhere(
            { id: leadId, status: { in: [LeadStatus.NEW, LeadStatus.NO_CONTACT] } },
            actor,
          ),
          data: { lastContactAt: new Date(), status: LeadStatus.CONTACTED },
        });
        if (advanced.count === 0) {
          const updated = await tx.lead.updateMany({
            where: scopeLeadWhere({ id: leadId }, actor),
            data: updateData,
          });
          if (updated.count !== 1) throw new NotFoundException("Lead não encontrado");
        }
      }

      return interaction;
    });
  }

  private async resolveAuthenticatedProfile(
    tx: Prisma.TransactionClient,
    userId: string,
  ): Promise<string> {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Usuário autenticado não encontrado");

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
  }

  private async ensureLeadAccess(leadId: string, actor: LeadAccessActor) {
    const lead = await this.prisma.lead.findFirst({
      where: scopeLeadWhere({ id: leadId }, actor),
      select: { id: true },
    });
    if (!lead) throw new NotFoundException("Lead não encontrado");
  }
}
