import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus } from "@prisma/client";
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

  async create(leadId: string, dto: CreateLeadInteractionDto) {
    await this.ensureLead(leadId);
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException("Usuário não encontrado");

    const interaction = await this.prisma.leadInteraction.create({
      data: {
        leadId,
        userId: dto.userId,
        type: dto.type,
        description: dto.description,
      },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });

    const updateData: any = {
      lastContactAt: new Date(),
      status: { set: dto.newStatus ?? LeadStatus.CONTACTED },
    };

    if (dto.nextActionAt) {
      updateData.nextActionAt = dto.nextActionAt;
    }

    await this.prisma.lead.update({
      where: { id: leadId },
      data: updateData,
    });

    return interaction;
  }

  private async ensureLead(leadId: string) {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw new NotFoundException("Lead não encontrado");
  }
}
