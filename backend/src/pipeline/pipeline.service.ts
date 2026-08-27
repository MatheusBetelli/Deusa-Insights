import { BadRequestException, Injectable } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";
import { calculateOpportunityScoreDetails } from "../common/scoring";
import { buildCnaeWhereInput, isValidOpportunity } from "../common/opportunity-filter";
import { buildLeadAccessWhere, LeadAccessActor } from "../common/lead-access.policy";

const pipelineStatuses = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.INTERESTED,
  LeadStatus.LINK_B2B_SENT,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED,
] as const;

const safeAssignedToSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PipelineQueryDto = {}, actor: LeadAccessActor) {
    const pageSize = Math.min(Math.max(1, query.columnPageSize ?? 6), 25);
    const totals = await Promise.all(
      pipelineStatuses.map((status) =>
        this.prisma.lead.count({
          where: this.buildWhere(query, status, actor),
        }),
      ),
    );
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);

    const stages = Object.fromEntries(
      await Promise.all(
        pipelineStatuses.map(async (status, index) => {
          const total = totals[index] ?? 0;
          const items = await this.findStageItems(status, query, 1, pageSize, actor);

          return [
            status,
            {
              status,
              total,
              page: 1,
              pageSize,
              totalPages: Math.max(1, Math.ceil(total / pageSize)),
              conversionRate: grandTotal === 0 ? 0 : Math.round((total / grandTotal) * 100),
              items,
            },
          ];
        }),
      ),
    );

    return { total: grandTotal, stages };
  }

  async findStage(status: string, query: PipelineQueryDto = {}, actor: LeadAccessActor) {
    if (!(pipelineStatuses as readonly LeadStatus[]).includes(status as LeadStatus)) {
      throw new BadRequestException("Etapa de funil inválida");
    }

    const typedStatus = status as LeadStatus;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 10), 100);
    const where = this.buildWhere(query, typedStatus, actor);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: {
          company: { include: { cnaes: true, details: true, contacts: true } },
          assignedTo: { select: safeAssignedToSelect },
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const validItems = items.filter((lead) => isValidOpportunity(lead.company));

    return {
      status: typedStatus,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: validItems.map((lead) => this.toCard(lead)),
    };
  }

  private async findStageItems(
    status: LeadStatus,
    query: PipelineQueryDto,
    page: number,
    pageSize: number,
    actor: LeadAccessActor,
  ) {
    const leads = await this.prisma.lead.findMany({
      where: this.buildWhere(query, status, actor),
      include: {
        company: { include: { cnaes: true, details: true, contacts: true } },
        assignedTo: { select: safeAssignedToSelect },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const validLeads = leads.filter((lead) => isValidOpportunity(lead.company));
    return validLeads.map((lead) => this.toCard(lead));
  }

  private buildWhere(query: PipelineQueryDto, status: LeadStatus, actor: LeadAccessActor) {
    const and: Prisma.LeadWhereInput[] = [
      buildLeadAccessWhere(actor),
      { status },
      { company: { situacaoCadastral: "ATIVA" } },
      { company: buildCnaeWhereInput(query.cnae) },
    ];

    if (query.uf && query.uf !== "Todos") {
      and.push({ company: { uf: query.uf.toUpperCase() } });
    }
    if (query.city && query.city !== "Todas") {
      and.push({ company: { cidade: { equals: query.city, mode: "insensitive" } } });
    }
    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      const digitsOnly = searchTerm.replace(/\D/g, "");
      const searchOr: Prisma.CompanyWhereInput[] = [
        { razaoSocial: { contains: searchTerm, mode: "insensitive" } },
        { nomeFantasia: { contains: searchTerm, mode: "insensitive" } },
        { cidade: { contains: searchTerm, mode: "insensitive" } },
        { bairro: { contains: searchTerm, mode: "insensitive" } },
        { logradouro: { contains: searchTerm, mode: "insensitive" } },
      ];

      if (digitsOnly.length > 0) {
        searchOr.push({ cnpj: { contains: digitsOnly } });
      }

      and.push({ company: { OR: searchOr } });
    }

    return { AND: and };
  }

  private toCard(
    lead: Prisma.LeadGetPayload<{
      include: {
        company: { include: { cnaes: true; details: true; contacts: true } };
        assignedTo: { select: typeof safeAssignedToSelect };
      };
    }>,
  ) {
    const fullScore = calculateOpportunityScoreDetails({
      cnpj: lead.company.cnpj,
      situacaoCadastral: lead.company.situacaoCadastral,
      cnaePrincipal: lead.company.cnaePrincipal,
      cnaes: lead.company.cnaes,
      nomeFantasia: lead.company.nomeFantasia,
      porte: lead.company.porte,
      cidade: lead.company.cidade,
      uf: lead.company.uf,
      latitude: lead.company.latitude,
      longitude: lead.company.longitude,
      logradouro: lead.company.logradouro,
      numero: lead.company.numero,
        bairro: lead.company.bairro,
        cep: lead.company.cep,
        telefone: this.getCommercialPhone(lead.company),
        statusLead: lead.status,
      });

    return {
      id: lead.id,
      companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
      city: lead.company.cidade,
      status: lead.status,
      score: fullScore.score,
      potentialLevel: fullScore.level,
      scoreBreakdown: fullScore.breakdown,
      scoreReasons: fullScore.reasons,
      assignedTo: lead.assignedTo?.name ?? null,
    };
  }

  private getCommercialPhone(company: {
    telefoneEncontrado?: string | null;
    details?: { telefone?: string | null } | null;
    contacts?: Array<{ type: string; value: string; active: boolean; isPrimary: boolean }>;
  }) {
    const contact =
      company.contacts
        ?.filter((item) => item.active && (item.type === "PHONE" || item.type === "WHATSAPP"))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0] ?? null;
    return contact?.value || company.details?.telefone || company.telefoneEncontrado || null;
  }
}
