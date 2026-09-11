import { randomUUID } from "crypto";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Optional,
} from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildLeadAccessWhere,
  LeadAccessActor,
  scopeLeadWhere,
} from "../common/lead-access.policy";
import { CommercialActivitiesQueryDto } from "./dto/commercial-activities-query.dto";
import { CreateCommercialActionDto } from "./dto/create-commercial-action.dto";
import { CreateLeadInteractionDto } from "./dto/create-lead-interaction.dto";
import { DashboardService } from "../dashboard/dashboard.service";
import { MapOpportunitiesService } from "../map-opportunities/map-opportunities.service";

const B2B_LINK_SENT_INTERACTION_TYPE = "B2B_LINK_SENT";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const interactionUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

type InteractionInput = {
  type: string;
  description?: string;
  newStatus?: LeadStatus;
  nextActionAt?: Date;
  nextContactAt?: Date;
};

const commercialActivitySelect = {
  id: true,
  leadId: true,
  type: true,
  description: true,
  createdAt: true,
  nextContactAt: true,
  followUpCompletedAt: true,
  lead: {
    select: {
      id: true,
      lastContactAt: true,
      company: {
        select: {
          id: true,
          nomeFantasia: true,
          razaoSocial: true,
          cidade: true,
        },
      },
    },
  },
  user: { select: interactionUserSelect },
  userLegacy: { select: interactionUserSelect },
} satisfies Prisma.LeadInteractionSelect;

function resolveNewStatus(dto: InteractionInput): LeadStatus | undefined {
  return (
    dto.newStatus ??
    (dto.type === B2B_LINK_SENT_INTERACTION_TYPE ? LeadStatus.LINK_B2B_SENT : undefined)
  );
}

function assertManualStatusIsAllowed(dto: InteractionInput): void {
  if (resolveNewStatus(dto) === LeadStatus.CONVERTED) {
    throw new BadRequestException(
      "Status CONVERTED é reservado para confirmação via B2B/ERP ou importação oficial de clientes.",
    );
  }
}

@Injectable()
export class LeadInteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly dashboardService?: DashboardService,
    @Optional() private readonly mapOpportunitiesService?: MapOpportunitiesService,
  ) {}

  async findByLead(leadId: string, actor: LeadAccessActor) {
    await this.ensureLeadAccess(leadId, actor);
    return this.prisma.leadInteraction.findMany({
      where: { leadId },
      include: {
        user: { select: interactionUserSelect },
        userLegacy: { select: interactionUserSelect },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async findCommercialActivities(query: CommercialActivitiesQueryDto = {}, actor: LeadAccessActor) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const where = await this.buildCommercialActivitiesWhere(query, actor);
    const isFollowUpView = query.view === "followups";

    const [total, interactions] = await this.prisma.$transaction([
      this.prisma.leadInteraction.count({ where }),
      this.prisma.leadInteraction.findMany({
        where,
        select: commercialActivitySelect,
        orderBy: isFollowUpView
          ? [{ nextContactAt: "asc" as const }, { id: "asc" as const }]
          : [{ createdAt: "desc" as const }, { id: "desc" as const }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: interactions.map((interaction) => ({
        interactionId: interaction.id,
        leadId: interaction.leadId,
        companyId: interaction.lead.company.id,
        companyName: interaction.lead.company.nomeFantasia || interaction.lead.company.razaoSocial,
        city: interaction.lead.company.cidade,
        type: interaction.type,
        description: interaction.description,
        createdAt: interaction.createdAt,
        lastContactAt: interaction.lead.lastContactAt,
        nextContactAt: interaction.nextContactAt,
        followUpCompletedAt: interaction.followUpCompletedAt,
        responsibleProfileId: interaction.user?.id ?? null,
        responsibleName: interaction.user?.name ?? interaction.userLegacy?.name ?? null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async create(leadId: string, dto: CreateLeadInteractionDto, actor: LeadAccessActor) {
    assertManualStatusIsAllowed(dto);
    const interaction = await this.prisma.$transaction((tx) =>
      this.createInteractionInTransaction(
        tx,
        leadId,
        { ...dto, nextContactAt: dto.nextActionAt },
        actor,
      ),
    );
    this.invalidateCommercialReadCaches();
    return interaction;
  }

  async createCommercialAction(
    leadId: string,
    dto: CreateCommercialActionDto,
    actor: LeadAccessActor,
  ) {
    const interaction = await this.prisma.$transaction((tx) =>
      this.createInteractionInTransaction(tx, leadId, dto, actor),
    );
    this.invalidateCommercialReadCaches();
    return interaction;
  }

  async completeFollowUp(leadId: string, interactionId: string, actor: LeadAccessActor) {
    const interaction = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.findFirst({
        where: scopeLeadWhere({ id: leadId }, actor),
        select: { id: true, nextActionAt: true },
      });
      if (!lead) throw new NotFoundException("Lead não encontrado");

      const pendingFollowUp = await tx.leadInteraction.findFirst({
        where: {
          id: interactionId,
          leadId,
          nextContactAt: { not: null },
          followUpCompletedAt: null,
        },
      });
      if (!pendingFollowUp) throw new NotFoundException("Retorno agendado não encontrado");

      const completedAt = new Date();
      const updated = await tx.leadInteraction.update({
        where: { id: pendingFollowUp.id },
        data: { followUpCompletedAt: completedAt },
        include: { user: { select: interactionUserSelect } },
      });

      if (
        lead.nextActionAt &&
        pendingFollowUp.nextContactAt &&
        lead.nextActionAt.getTime() === pendingFollowUp.nextContactAt.getTime()
      ) {
        await tx.lead.updateMany({
          where: scopeLeadWhere({ id: leadId, nextActionAt: pendingFollowUp.nextContactAt }, actor),
          data: { nextActionAt: null },
        });
      }

      return updated;
    });
    this.invalidateCommercialReadCaches();
    return interaction;
  }

  private async createInteractionInTransaction(
    tx: Prisma.TransactionClient,
    leadId: string,
    dto: InteractionInput,
    actor: LeadAccessActor,
  ) {
    assertManualStatusIsAllowed(dto);
    const newStatus = resolveNewStatus(dto);

    const updateData: Prisma.LeadUpdateInput = {
      lastContactAt: new Date(),
    };

    const nextContactAt = dto.nextContactAt ?? dto.nextActionAt;
    if (nextContactAt) {
      updateData.nextActionAt = nextContactAt;
    }

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
        description: dto.description?.trim() || "Ação comercial registrada pelo mapa.",
        nextContactAt,
      },
      include: { user: { select: interactionUserSelect } },
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
        data: { ...updateData, status: LeadStatus.CONTACTED },
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

  private async buildCommercialActivitiesWhere(
    query: CommercialActivitiesQueryDto,
    actor: LeadAccessActor,
  ): Promise<Prisma.LeadInteractionWhereInput> {
    const interactionAnd: Prisma.LeadInteractionWhereInput[] = [
      {
        lead: {
          AND: [
            buildLeadAccessWhere(actor),
            {
              company: this.buildCompanyFilter(query.company, query.city),
            },
          ],
        },
      },
    ];

    if (query.type) interactionAnd.push({ type: query.type });

    const responsibleFilter = await this.buildResponsibleFilter(query.responsibleId);
    if (responsibleFilter) interactionAnd.push(responsibleFilter);

    if (query.view === "followups") {
      interactionAnd.push({ nextContactAt: { not: null }, followUpCompletedAt: null });
      const nextContactAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
      if (nextContactAt) interactionAnd.push({ nextContactAt });
    } else {
      const createdAt = this.buildCreatedAtFilter(query.dateFrom, query.dateTo);
      if (createdAt) interactionAnd.push({ createdAt });
    }

    return { AND: interactionAnd };
  }

  private buildCompanyFilter(company?: string, city?: string): Prisma.CompanyWhereInput {
    const conditions: Prisma.CompanyWhereInput[] = [];
    const search = company?.trim();
    if (search) {
      const text = { contains: search, mode: "insensitive" as const };
      const digits = search.replace(/\D/g, "");
      conditions.push({
        OR: [
          { nomeFantasia: text },
          { razaoSocial: text },
          ...(digits.length >= 3 ? [{ cnpj: { contains: digits } }] : []),
        ],
      });
    }
    if (city?.trim()) {
      conditions.push({ cidade: { equals: city.trim(), mode: "insensitive" } });
    }
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  private buildCreatedAtFilter(dateFrom?: string, dateTo?: string): Prisma.DateTimeFilter | null {
    if (!dateFrom && !dateTo) return null;

    const filter: Prisma.DateTimeFilter = {};
    if (dateFrom) filter.gte = parseDateFilterValue(dateFrom, "dateFrom");
    if (dateTo) {
      const end = parseDateFilterValue(dateTo, "dateTo");
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        end.setUTCDate(end.getUTCDate() + 1);
        filter.lt = end;
      } else {
        filter.lte = end;
      }
    }

    if (filter.gte && filter.lt && filter.gte >= filter.lt) {
      throw new BadRequestException("O período informado é inválido");
    }
    if (filter.gte && filter.lte && filter.gte > filter.lte) {
      throw new BadRequestException("O período informado é inválido");
    }
    return filter;
  }

  private async buildResponsibleFilter(
    responsibleId?: string,
  ): Promise<Prisma.LeadInteractionWhereInput | null> {
    const cleanId = responsibleId?.trim();
    if (!cleanId) return null;

    const alternatives: Prisma.LeadInteractionWhereInput[] = [{ userId_legacy: cleanId }];
    if (UUID_PATTERN.test(cleanId)) {
      alternatives.push({ userId: cleanId });
      return { OR: alternatives };
    }

    const mapping = await this.prisma.userMapping.findUnique({
      where: { cuid: cleanId },
      select: { uuid: true },
    });
    if (mapping) {
      alternatives.push({ userId: mapping.uuid });
      return { OR: alternatives };
    }

    const legacyUser = await this.prisma.user.findUnique({
      where: { id: cleanId },
      select: { email: true },
    });
    if (legacyUser) {
      const profile = await this.prisma.profile.findUnique({
        where: { email: legacyUser.email },
        select: { id: true },
      });
      if (profile) alternatives.push({ userId: profile.id });
    }
    return { OR: alternatives };
  }

  private invalidateCommercialReadCaches(): void {
    this.dashboardService?.clearCache();
    this.mapOpportunitiesService?.invalidateCache();
  }
}

function parseDateFilterValue(value: string, field: string): Date {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${field} possui uma data inválida`);
  }
  return parsed;
}
