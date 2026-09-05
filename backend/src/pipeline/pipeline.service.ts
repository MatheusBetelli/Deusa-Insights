import { BadRequestException, Injectable } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { LeadAccessActor } from "../common/lead-access.policy";
import { buildDashboardFilters } from "../dashboard/dashboard-filters";
import { resolvePeriod } from "../dashboard/dashboard.service";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";

const pipelineStatuses = [LeadStatus.NEW, LeadStatus.CONVERTED] as const;
type PipelineStatus = (typeof pipelineStatuses)[number];

const leadSelect = {
  id: true,
  assignedTo: { select: { name: true } },
} as const;
const companySelect = {
  id: true,
  nomeFantasia: true,
  razaoSocial: true,
  cidade: true,
  lead: { select: leadSelect },
} as const;
const clientSelect = {
  id: true,
  nomeFantasia: true,
  razaoSocial: true,
  cidade: true,
  company: { select: { lead: { select: leadSelect } } },
} as const;

type PipelineCard = {
  id: string;
  leadId: string | null;
  companyName: string;
  city: string | null;
  status: PipelineStatus;
  assignedTo: string | null;
};

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PipelineQueryDto = {}, actor: LeadAccessActor) {
    const pageSize = Math.min(Math.max(1, query.columnPageSize ?? 6), 25);
    const period = resolvePeriod(query);
    const filters = this.buildFilters(query, period.end, actor);
    // Counts and cards share one snapshot, with no status mutations.
    const results = await this.prisma.$transaction(
      (tx) =>
        Promise.all(
          pipelineStatuses.map((status) => this.readStage(tx, status, filters, 1, pageSize)),
        ),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
    const total = results.reduce((sum, stage) => sum + stage.total, 0);
    return {
      total,
      period: {
        key: period.key,
        label: period.label,
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        previousStart: period.previousStart.toISOString(),
        previousEnd: period.previousEnd.toISOString(),
      },
      stages: Object.fromEntries(
        results.map((stage) => [
          stage.status,
          {
            ...stage,
            conversionRate: total === 0 ? 0 : Math.round((stage.total / total) * 100),
          },
        ]),
      ),
    };
  }

  async findStage(status: string, query: PipelineQueryDto = {}, actor: LeadAccessActor) {
    if (!(pipelineStatuses as readonly string[]).includes(status)) {
      throw new BadRequestException("Etapa de funil inválida; use novos ou clientes confirmados");
    }
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 10), 100);
    const filters = this.buildFilters(query, resolvePeriod(query).end, actor);
    return this.prisma.$transaction(
      (tx) => this.readStage(tx, status as PipelineStatus, filters, page, pageSize),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private buildFilters(query: PipelineQueryDto, periodEnd: Date, actor: LeadAccessActor) {
    const { confirmedClientWhere, opportunityWhere } = buildDashboardFilters(
      query,
      periodEnd,
      actor,
    );
    const term = query.search?.trim();
    if (!term) return { confirmedClientWhere, opportunityWhere };
    const text = { contains: term, mode: "insensitive" as const };
    const digits = term.replace(/\D/g, "");
    // Search the official account itself, including accounts without a linked company.
    const accountSearch: Prisma.ClientAccountWhereInput[] = [
      { razaoSocial: text },
      { nomeFantasia: text },
      { cidade: text },
      ...(digits ? [{ cnpj: { contains: digits } }] : []),
    ];
    const companySearch: Prisma.CompanyWhereInput[] = [
      { razaoSocial: text },
      { nomeFantasia: text },
      { cidade: text },
      { bairro: text },
      { logradouro: text },
      ...(digits ? [{ cnpj: { contains: digits } }] : []),
    ];
    return {
      confirmedClientWhere: { AND: [confirmedClientWhere, { OR: accountSearch }] },
      opportunityWhere: { AND: [opportunityWhere, { OR: companySearch }] },
    };
  }

  private async readStage(
    tx: Prisma.TransactionClient,
    status: PipelineStatus,
    filters: ReturnType<PipelineService["buildFilters"]>,
    page: number,
    pageSize: number,
  ) {
    const pagination = { skip: (page - 1) * pageSize, take: pageSize };
    let total: number;
    let items: PipelineCard[];
    if (status === LeadStatus.CONVERTED) {
      const [count, accounts] = await Promise.all([
        tx.clientAccount.count({ where: filters.confirmedClientWhere }),
        tx.clientAccount.findMany({
          where: filters.confirmedClientWhere,
          select: clientSelect,
          orderBy: [{ razaoSocial: "asc" }, { id: "asc" }],
          ...pagination,
        }),
      ]);
      total = count;
      items = accounts.map((account) => ({
        id: `account:${account.id}`,
        leadId: account.company?.lead?.id ?? null,
        companyName: account.nomeFantasia || account.razaoSocial,
        city: account.cidade,
        status,
        assignedTo: account.company?.lead?.assignedTo?.name ?? null,
      }));
    } else {
      const [count, companies] = await Promise.all([
        tx.company.count({ where: filters.opportunityWhere }),
        tx.company.findMany({
          where: filters.opportunityWhere,
          select: companySelect,
          orderBy: [{ razaoSocial: "asc" }, { id: "asc" }],
          ...pagination,
        }),
      ]);
      total = count;
      items = companies.map((company) => ({
        id: `company:${company.id}`,
        leadId: company.lead?.id ?? null,
        companyName: company.nomeFantasia || company.razaoSocial,
        city: company.cidade,
        status,
        assignedTo: company.lead?.assignedTo?.name ?? null,
      }));
    }
    return {
      status,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items,
    };
  }
}
