import { BadRequestException, Injectable } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";
import { calculateOpportunityScoreDetails } from "../common/scoring";
import { isValidOpportunity, TARGET_OPPORTUNITY_CNAES } from "../common/opportunity-filter";

const pipelineStatuses = [
  LeadStatus.NEW,
  LeadStatus.CONTACTED,
  LeadStatus.INTERESTED,
  LeadStatus.NEGOTIATION,
  LeadStatus.CONVERTED,
] as const;

const safeAssignedToSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

function normalizeCnae(code?: string | null) {
  return code?.replace(/\D/g, "") || undefined;
}

@Injectable()
export class PipelineService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PipelineQueryDto = {}) {
    const pageSize = Math.min(Math.max(1, query.columnPageSize ?? 6), 25);
    const totals = await Promise.all(
      pipelineStatuses.map((status) =>
        this.prisma.lead.count({
          where: this.buildWhere(query, status),
        }),
      ),
    );
    const grandTotal = totals.reduce((sum, value) => sum + value, 0);

    const stages = Object.fromEntries(
      await Promise.all(
        pipelineStatuses.map(async (status, index) => {
          const total = totals[index] ?? 0;
          const items = await this.findStageItems(status, query, 1, pageSize);

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

  async findStage(status: string, query: PipelineQueryDto = {}) {
    if (!(pipelineStatuses as readonly LeadStatus[]).includes(status as LeadStatus)) {
      throw new BadRequestException("Etapa de funil inválida");
    }

    const typedStatus = status as LeadStatus;
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 10), 100);
    const where = this.buildWhere(query, typedStatus);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: { company: true, assignedTo: { select: safeAssignedToSelect } },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const validItems = items.filter((lead) => isValidOpportunity(lead.company));

    return {
      status: typedStatus,
      total: validItems.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(validItems.length / pageSize)),
      items: validItems.map((lead) => this.toCard(lead)),
    };
  }

  private async findStageItems(
    status: LeadStatus,
    query: PipelineQueryDto,
    page: number,
    pageSize: number,
  ) {
    const leads = await this.prisma.lead.findMany({
      where: this.buildWhere(query, status),
      include: { company: true, assignedTo: { select: safeAssignedToSelect } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const validLeads = leads.filter((lead) => isValidOpportunity(lead.company));
    return validLeads.map((lead) => this.toCard(lead));
  }

  private buildWhere(query: PipelineQueryDto, status: LeadStatus) {
    const and: Prisma.LeadWhereInput[] = [
      { status },
      { company: { situacaoCadastral: "ATIVA" } },
    ];

    if (!query.cnae || query.cnae === "Todos") {
      and.push({
        company: { cnaePrincipal: { in: Array.from(TARGET_OPPORTUNITY_CNAES) } },
      });
    }

    if (query.uf && query.uf !== "Todos") {
      and.push({ company: { uf: query.uf.toUpperCase() } });
    }
    if (query.city && query.city !== "Todas") {
      and.push({ company: { cidade: { equals: query.city, mode: "insensitive" } } });
    }
    if (query.cnae && query.cnae !== "Todos") {
      const cnae = normalizeCnae(query.cnae);
      and.push({
        company: {
          OR: [{ cnaePrincipal: cnae }, { cnaes: { some: { cnaeCode: cnae } } }],
        },
      });
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
      include: { company: true; assignedTo: { select: typeof safeAssignedToSelect } };
    }>,
  ) {
    const fullScore = calculateOpportunityScoreDetails({
      cnpj: lead.company.cnpj,
      situacaoCadastral: lead.company.situacaoCadastral,
      cnaePrincipal: lead.company.cnaePrincipal,
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
      assignedTo: lead.assignedTo?.name ?? null,
    };
  }
}
