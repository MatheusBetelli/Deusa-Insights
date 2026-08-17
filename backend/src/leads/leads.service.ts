import { Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import { calculateLeadScore, getPotentialLevel, calculateOpportunityScoreDetails } from "../common/scoring";
import { buildCnaeWhereInput, isValidOpportunity } from "../common/opportunity-filter";
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
  company: { include: { cnaes: true, details: true } },
  assignedTo: { select: safeAssignedToSelect },
} satisfies Prisma.LeadInclude;

function csvValue(value: unknown) {
  if (value === null || value === undefined) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LeadQueryDto = {}) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? query.limit ?? query.perPage ?? 10), 100);

    const where = this.buildWhere(query);
    const [total, items, targetCompanies] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.findMany({
        where: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
        select: { id: true, cidade: true, bairro: true, latitude: true, longitude: true },
      }),
    ]);

    const validItems = items.filter((lead) => isValidOpportunity(lead.company));
    const neighborCounts = this.computeSpatialClusters(validItems, targetCompanies);

    const enrichedItems = validItems.map((lead) => {
      const neighborCount = neighborCounts.get(lead.company.id) ?? 0;
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
        neighborCount,
      });

      return {
        ...lead,
        score: fullScore.score,
        potentialLevel: fullScore.level,
        scoreBreakdown: fullScore.breakdown,
      };
    });

    return {
      items: enrichedItems,
      total: total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findPage(query: LeadQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(Math.max(1, query.pageSize ?? query.limit ?? query.perPage ?? 25), 100);
    const where = this.buildWhere(query);
    const [total, items, targetCompanies] = await this.prisma.$transaction([
      this.prisma.lead.count({ where }),
      this.prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: this.buildOrderBy(query),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.findMany({
        where: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
        select: { id: true, cidade: true, bairro: true, latitude: true, longitude: true },
      }),
    ]);

    const validItems = items.filter((lead) => isValidOpportunity(lead.company));
    const neighborCounts = this.computeSpatialClusters(validItems, targetCompanies);

    const enrichedItems = validItems.map((lead) => {
      const neighborCount = neighborCounts.get(lead.company.id) ?? 0;
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
        neighborCount,
      });

      return {
        ...lead,
        score: fullScore.score,
        potentialLevel: fullScore.level,
        scoreBreakdown: fullScore.breakdown,
      };
    });

    return {
      items: enrichedItems,
      total: total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async exportCsv(query: LeadQueryDto) {
    const rawLeads = await this.prisma.lead.findMany({
      where: this.buildWhere(query),
      include: leadInclude,
      orderBy: this.buildOrderBy(query),
      take: 10000,
    });

    const leads = rawLeads.filter((lead) => isValidOpportunity(lead.company));

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
    return (
      query.page !== undefined ||
      query.pageSize !== undefined ||
      query.limit !== undefined ||
      query.perPage !== undefined
    );
  }

  private buildWhere(query: LeadQueryDto) {
    const where: Prisma.LeadWhereInput = {};
    const and: Prisma.LeadWhereInput[] = [
      { company: { situacaoCadastral: "ATIVA" } },
      { company: buildCnaeWhereInput(query.cnae) },
    ];

    if (query.status) where.status = query.status;
    if (query.potentialLevel) where.potentialLevel = query.potentialLevel;
    if (query.assignedToId) where.assignedToId = query.assignedToId;
    if (query.minScore !== undefined || query.maxScore !== undefined) {
      where.score = { gte: query.minScore, lte: query.maxScore };
    }
    if (query.city) and.push({ company: { cidade: { equals: query.city, mode: "insensitive" } } });
    if (query.uf) and.push({ company: { uf: query.uf.toUpperCase() } });
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
      ...lead,
      score: fullScore.score,
      potentialLevel: fullScore.level,
      scoreBreakdown: fullScore.breakdown,
    };
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

  async autoAssignTerritory() {
    const unassignedLeads = await this.prisma.lead.findMany({
      where: { assignedToId: null },
      include: { company: true },
    });

    const salesUsers = await this.prisma.user.findMany({
      where: { role: { in: ["SALES", "MANAGER"] } },
      select: { id: true, name: true, email: true },
    });

    if (salesUsers.length === 0) {
      return { success: false, message: "Nenhum vendedor ou gerente cadastrado no sistema." };
    }

    let assignedCount = 0;
    const cityMap: Record<string, string> = {};

    // Mapeamento territorial de vendedores da Deusa Alimentos por região
    for (const user of salesUsers) {
      const nameLower = user.name.toLowerCase();
      if (nameLower.includes("rafael")) {
        cityMap["tupã"] = user.id;
        cityMap["marília"] = user.id;
        cityMap["pompeia"] = user.id;
      } else if (nameLower.includes("camila")) {
        cityMap["araçatuba"] = user.id;
        cityMap["bauru"] = user.id;
        cityMap["lins"] = user.id;
      } else if (nameLower.includes("felipe")) {
        cityMap["ourinhos"] = user.id;
        cityMap["assis"] = user.id;
        cityMap["bastos"] = user.id;
      }
    }

    for (let i = 0; i < unassignedLeads.length; i++) {
      const lead = unassignedLeads[i];
      const cityClean = lead.company.cidade?.toLowerCase().trim() || "";
      const assignedId = cityMap[cityClean] || salesUsers[i % salesUsers.length].id;

      await this.prisma.lead.update({
        where: { id: lead.id },
        data: { assignedToId: assignedId },
      });
      assignedCount++;
    }

    return {
      success: true,
      assignedCount,
      message: `${assignedCount} leads foram atribuídos automaticamente aos vendedores por região de atuação.`,
    };
  }

  private computeSpatialClusters<T extends { company: { id: string; cidade?: string | null; bairro?: string | null; latitude?: number | null; longitude?: number | null } }>(
    leads: T[],
    allCompanies: Array<{ id: string; cidade: string; bairro?: string | null; latitude?: number | null; longitude?: number | null }>,
  ): Map<string, number> {
    const counts = new Map<string, number>();

    for (const lead of leads) {
      let count = 0;
      const lat1 = lead.company.latitude;
      const lon1 = lead.company.longitude;
      const city1 = (lead.company.cidade || "").toLowerCase().trim();
      const bairro1 = (lead.company.bairro || "").toLowerCase().trim();

      for (const comp of allCompanies) {
        if (comp.id === lead.company.id) continue;
        const city2 = (comp.cidade || "").toLowerCase().trim();
        if (city1 && city2 && city1 !== city2) continue;

        const lat2 = comp.latitude;
        const lon2 = comp.longitude;

        if (
          typeof lat1 === "number" &&
          typeof lon1 === "number" &&
          lat1 !== 0 &&
          typeof lat2 === "number" &&
          typeof lon2 === "number" &&
          lat2 !== 0
        ) {
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
              Math.cos((lat2 * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          if (distKm <= 1.5) {
            count++;
          }
        } else if (bairro1 && comp.bairro && bairro1 === comp.bairro.toLowerCase().trim()) {
          count++;
        }
      }
      counts.set(lead.company.id, count);
    }
    return counts;
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
