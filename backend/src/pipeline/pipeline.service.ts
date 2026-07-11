import { BadRequestException, Injectable } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { PipelineQueryDto } from "./dto/pipeline-query.dto";

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

    return {
      status: typedStatus,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      items: items.map((lead) => this.toCard(lead)),
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

    return leads.map((lead) => this.toCard(lead));
  }

  private buildWhere(query: PipelineQueryDto, status: LeadStatus) {
    const and: Prisma.LeadWhereInput[] = [{ status }];

    if (query.city) and.push({ company: { cidade: { equals: query.city, mode: "insensitive" } } });
    if (query.cnae) {
      const cnae = normalizeCnae(query.cnae);
      and.push({
        company: {
          OR: [{ cnaePrincipal: cnae }, { cnaes: { some: { cnaeCode: cnae } } }],
        },
      });
    }
    if (query.search) {
      and.push({
        company: {
          OR: [
            { cnpj: { contains: query.search.replace(/\D/g, "") } },
            { razaoSocial: { contains: query.search, mode: "insensitive" } },
            { nomeFantasia: { contains: query.search, mode: "insensitive" } },
          ],
        },
      });
    }

    return { AND: and };
  }

  private toCard(
    lead: Prisma.LeadGetPayload<{
      include: { company: true; assignedTo: { select: typeof safeAssignedToSelect } };
    }>,
  ) {
    return {
      id: lead.id,
      companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
      city: lead.company.cidade,
      status: lead.status,
      score: lead.score,
      potentialLevel: lead.potentialLevel,
      assignedTo: lead.assignedTo?.name ?? null,
    };
  }
}
