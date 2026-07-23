import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { calculateLeadScore, getPotentialLevel } from "../common/scoring";
import { PrismaService } from "../prisma/prisma.service";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";

function normalizeCnae(code?: string | null) {
  return code?.replace(/\D/g, "") || undefined;
}

const safeAssignedToSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const leadInclude = {
  company: { include: { cnaes: true } },
  assignedTo: { select: safeAssignedToSelect },
} satisfies Prisma.LeadInclude;

function csvValue(value: unknown) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LeadQueryDto) {
    if (this.shouldPaginate(query)) {
      return this.findPage(query);
    }

    return this.prisma.lead.findMany({
      where: this.buildWhere(query),
      include: leadInclude,
      orderBy: this.buildOrderBy(query),
      take: 250,
    });
  }

  async findPage(query: LeadQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? 25), 100);
    const where = this.buildWhere(query);
    const [total, items] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async exportCsv(query: LeadQueryDto) {
    const leads = await this.prisma.lead.findMany({
      where: this.buildWhere(query),
      include: leadInclude,
      orderBy: this.buildOrderBy(query),
      take: 10000,
    });

    const header = [
      "Empresa",
      "CNPJ",
      "Cidade",
      "UF",
      "CNAE",
      "Status Comercial",
      "Score",
      "Potencial",
      "Responsavel",
      "Ultimo Contato",
      "Confianca",
      "Verificacao Endereco",
      "Situacao Cadastral",
    ];

    const rows = leads.map((lead) => [
      lead.company.nomeFantasia || lead.company.razaoSocial,
      lead.company.cnpj,
      lead.company.cidade,
      lead.company.uf,
      lead.company.cnaePrincipal,
      lead.status,
      lead.score,
      lead.potentialLevel,
      lead.assignedTo?.name ?? "",
      lead.lastContactAt?.toISOString() ?? "",
      lead.company.confiancaVerificacao ?? "",
      lead.company.statusVerificacaoEndereco ?? "",
      lead.company.situacaoCadastral,
    ]);

    return [header, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
  }

  private shouldPaginate(query: LeadQueryDto) {
    return query.page !== undefined || query.pageSize !== undefined;
  }

  private buildWhere(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {};
    const and: Prisma.LeadWhereInput[] = [
      { company: { situacaoCadastral: "ATIVA" } },
    ];

    if (query.status) where.status = query.status;
    if (query.potentialLevel) where.potentialLevel = query.potentialLevel;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = { gte: query.minScore, lte: query.maxScore };
    }
    if (query.city) and.push({ company: { cidade: { equals: query.city, mode: "insensitive" } } });
    if (query.uf) and.push({ company: { uf: query.uf.toUpperCase() } });
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
    if (query.statusVerificacaoEndereco) {
      and.push({ company: { statusVerificacaoEndereco: query.statusVerificacaoEndereco } });
    }
    if (query.pendenteValidacao !== undefined) {
      const normalized = String(query.pendenteValidacao).toLowerCase();
      if (["true", "sim", "1"].includes(normalized)) {
        and.push({ company: { pendenteValidacao: true } });
      }
      if (["false", "nao", "não", "0"].includes(normalized)) {
        and.push({ company: { pendenteValidacao: false } });
      }
    }
    if (query.situacaoCadastral) {
      and.push({
        company: { situacaoCadastral: { equals: query.situacaoCadastral, mode: "insensitive" } },
      });
    }
    if (and.length > 0) where.AND = and;

    return where;
  }

  private buildOrderBy(query: LeadQueryDto): Prisma.LeadOrderByWithRelationInput[] {
    const direction = query.sortOrder === "asc" ? "asc" : "desc";

    if (query.sortBy === "company")
      return [{ company: { razaoSocial: direction } }, { score: "desc" }];
    if (query.sortBy === "city") return [{ company: { cidade: direction } }, { score: "desc" }];
    if (query.sortBy === "potential") return [{ potentialLevel: direction }, { score: "desc" }];
    if (query.sortBy === "createdAt") return [{ createdAt: direction }, { score: "desc" }];
    return [{ score: direction }, { createdAt: "desc" }];
  }

  async findById(id: string) {
    const lead = await this.prisma.lead.findUnique({
      where: { id },
      include: {
        company: { include: { cnaes: true } },
        assignedTo: { select: safeAssignedToSelect },
        interactions: {
          include: { user: { select: safeAssignedToSelect } },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!lead) throw new NotFoundException("Lead não encontrado");
    return lead;
  }

  async create(dto: CreateLeadDto) {
    const company = await this.prisma.company.findUnique({ where: { id: dto.companyId } });
    if (!company) throw new NotFoundException("Empresa não encontrada");

    const targetCnaes = await this.getTargetCnaes();
    const priorityCities = await this.getPriorityCities();
    const score =
      dto.score ??
      calculateLeadScore({
        ...company,
        targetCnaes,
        priorityCities,
      });

    return this.prisma.lead.create({
      data: {
        companyId: dto.companyId,
        status: dto.status ?? LeadStatus.NEW,
        score,
        potentialLevel: dto.potentialLevel ?? getPotentialLevel(score),
        assignedToId: dto.assignedToId,
        notes: dto.notes,
        lastContactAt: dto.lastContactAt,
        nextActionAt: dto.nextActionAt,
      },
      include: { company: true, assignedTo: { select: safeAssignedToSelect } },
    });
  }

  async update(id: string, dto: UpdateLeadDto) {
    await this.findById(id);
    return this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        potentialLevel:
          dto.score !== undefined && dto.potentialLevel === undefined
            ? getPotentialLevel(dto.score)
            : dto.potentialLevel,
      },
      include: { company: true, assignedTo: { select: safeAssignedToSelect } },
    });
  }

  convert(id: string) {
    return this.update(id, { status: LeadStatus.CONVERTED, lastContactAt: new Date() });
  }

  discard(id: string) {
    return this.update(id, { status: LeadStatus.NOT_INTERESTED, lastContactAt: new Date() });
  }

  async upsertLeadForCompany(companyId: string, assignedToId?: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Empresa não encontrada");
    const targetCnaes = await this.getTargetCnaes();
    const priorityCities = await this.getPriorityCities();
    const score = calculateLeadScore({ ...company, targetCnaes, priorityCities });

    return this.prisma.lead.upsert({
      where: { companyId },
      create: {
        companyId,
        assignedToId,
        status: LeadStatus.NEW,
        score,
        potentialLevel: getPotentialLevel(score),
      },
      update: {
        score,
        potentialLevel: getPotentialLevel(score),
      },
      include: { company: true, assignedTo: { select: safeAssignedToSelect } },
    });
  }

  private async getTargetCnaes() {
    const cnaes = await this.prisma.cnae.findMany({
      where: { isTarget: true },
      select: { code: true },
    });
    return cnaes.map((cnae) => cnae.code);
  }

  private async getPriorityCities() {
    const cities = await this.prisma.city.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    return cities.map((city) => city.name);
  }
}
