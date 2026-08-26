import { randomUUID } from "crypto";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { LeadStatus, Prisma } from "@prisma/client";
import {
  calculateLeadScore,
  getPotentialLevel,
  calculateOpportunityScoreDetails,
} from "../common/scoring";
import { buildCnaeWhereInput, isValidOpportunity } from "../common/opportunity-filter";
import { PrismaService } from "../prisma/prisma.service";
import {
  assertSalesCannotManageLeadAssignment,
  buildLeadAccessWhere,
  hasFullPortfolioAccess,
  LeadAccessActor,
  scopeLeadWhere,
} from "../common/lead-access.policy";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";

const safeAssignedToSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
} as const;

const leadInclude = {
  company: {
    include: {
      cnaes: true,
      details: true,
      clientAccounts: {
        where: { isCurrentClient: true },
        select: { isCurrentClient: true },
      },
    },
  },
  assignedTo: { select: safeAssignedToSelect },
} satisfies Prisma.LeadInclude;

function csvValue(value: unknown) {
  if (value === null || value === undefined) return '""';
  const text = String(value);
  const spreadsheetSafe = /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${spreadsheetSafe.replace(/"/g, '""')}"`;
}

type SpatialCompany = {
  id: string;
  cidade?: string | null;
  bairro?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

function buildLeadSearchCondition(search?: string): Prisma.CompanyWhereInput | undefined {
  const searchTerm = search?.trim();
  if (!searchTerm) return undefined;

  const searchOr: Prisma.CompanyWhereInput[] = [
    { razaoSocial: { contains: searchTerm, mode: "insensitive" } },
    { nomeFantasia: { contains: searchTerm, mode: "insensitive" } },
    { cidade: { contains: searchTerm, mode: "insensitive" } },
    { bairro: { contains: searchTerm, mode: "insensitive" } },
    { logradouro: { contains: searchTerm, mode: "insensitive" } },
  ];
  const digitsOnly = searchTerm.replace(/\D/g, "");
  if (digitsOnly) searchOr.push({ cnpj: { contains: digitsOnly } });
  return { OR: searchOr };
}

function parsePendingValidation(value: LeadQueryDto["pendenteValidacao"]): boolean | undefined {
  if (value === undefined) return undefined;
  const normalized = String(value).toLowerCase();
  if (["true", "sim", "1"].includes(normalized)) return true;
  if (["false", "nao", "não", "0"].includes(normalized)) return false;
  return undefined;
}

function hasSpatialCoordinates(company: SpatialCompany): company is SpatialCompany & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof company.latitude === "number" &&
    typeof company.longitude === "number" &&
    company.latitude !== 0
  );
}

function haversineDistanceKm(
  first: SpatialCompany & { latitude: number; longitude: number },
  second: SpatialCompany & { latitude: number; longitude: number },
) {
  const dLat = ((second.latitude - first.latitude) * Math.PI) / 180;
  const dLon = ((second.longitude - first.longitude) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((first.latitude * Math.PI) / 180) *
      Math.cos((second.latitude * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function areSpatialNeighbors(first: SpatialCompany, second: SpatialCompany): boolean {
  if (first.id === second.id) return false;
  const firstCity = (first.cidade || "").toLowerCase().trim();
  const secondCity = (second.cidade || "").toLowerCase().trim();
  if (firstCity && secondCity && firstCity !== secondCity) return false;
  if (hasSpatialCoordinates(first) && hasSpatialCoordinates(second)) {
    return haversineDistanceKm(first, second) <= 1.5;
  }

  const firstNeighborhood = (first.bairro || "").toLowerCase().trim();
  const secondNeighborhood = (second.bairro || "").toLowerCase().trim();
  return Boolean(
    firstNeighborhood && secondNeighborhood && firstNeighborhood === secondNeighborhood,
  );
}

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: LeadQueryDto = {}, actor: LeadAccessActor) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(
      Math.max(1, query.pageSize ?? query.limit ?? query.perPage ?? 10),
      100,
    );

    const where = this.buildWhere(query, actor);
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

  async exportCsv(query: LeadQueryDto, actor: LeadAccessActor) {
    const rawLeads = await this.prisma.lead.findMany({
      where: this.buildWhere(query, actor),
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

  private buildWhere(query: LeadQueryDto, actor: LeadAccessActor) {
    const where: Prisma.LeadWhereInput = {};
    const and: Prisma.LeadWhereInput[] = [
      buildLeadAccessWhere(actor),
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
    const searchCondition = buildLeadSearchCondition(query.search);
    if (searchCondition) and.push({ company: searchCondition });
    if (query.statusVerificacaoEndereco) {
      and.push({ company: { statusVerificacaoEndereco: query.statusVerificacaoEndereco } });
    }
    const pendenteValidacao = parsePendingValidation(query.pendenteValidacao);
    if (pendenteValidacao !== undefined) and.push({ company: { pendenteValidacao } });
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

  async findById(id: string, actor: LeadAccessActor) {
    const lead = await this.prisma.lead.findFirst({
      where: scopeLeadWhere({ id }, actor),
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
      statusLead: lead.status,
    });

    return {
      ...lead,
      score: fullScore.score,
      potentialLevel: fullScore.level,
      scoreBreakdown: fullScore.breakdown,
    };
  }

  async create(dto: CreateLeadDto, actor: LeadAccessActor) {
    assertSalesCannotManageLeadAssignment(actor, dto);
    const company = await this.prisma.company.findUnique({
      where: { id: dto.companyId },
      include: { cnaes: true },
    });
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

    const requestedAssignee = hasFullPortfolioAccess(actor) ? dto.assignedToId : actor.sub;
    const assignedProfileId = requestedAssignee
      ? await this.resolveProfileId(requestedAssignee)
      : undefined;
    if (dto.assignedToId && !assignedProfileId) {
      throw new BadRequestException("Responsável informado não possui um perfil válido");
    }

    return this.prisma.lead.create({
      data: {
        companyId: dto.companyId,
        status: dto.status ?? LeadStatus.NEW,
        score,
        potentialLevel: dto.potentialLevel ?? getPotentialLevel(score),
        assignedToId: assignedProfileId,
        assignedToId_legacy: hasFullPortfolioAccess(actor) ? undefined : actor.sub,
        notes: dto.notes,
        lastContactAt: dto.lastContactAt,
        nextActionAt: dto.nextActionAt,
      },
      include: { company: true, assignedTo: { select: safeAssignedToSelect } },
    });
  }

  async update(id: string, dto: UpdateLeadDto, actor: LeadAccessActor) {
    assertSalesCannotManageLeadAssignment(actor, dto);
    await this.findById(id, actor);
    const { assignedToId, ...scalarFields } = dto;

    const updatePayload: Prisma.LeadUpdateInput = {
      ...scalarFields,
      potentialLevel:
        dto.score !== undefined && dto.potentialLevel === undefined
          ? getPotentialLevel(dto.score)
          : dto.potentialLevel,
    };

    if (assignedToId !== undefined) {
      const profileId = await this.resolveProfileId(assignedToId);
      if (assignedToId && !profileId) {
        throw new BadRequestException("Responsável informado não possui um perfil válido");
      }
      if (profileId) {
        updatePayload.assignedTo = { connect: { id: profileId } };
      } else {
        updatePayload.assignedTo = { disconnect: true };
      }
    }

    if (hasFullPortfolioAccess(actor)) {
      return this.prisma.lead.update({
        where: { id },
        data: updatePayload,
        include: { company: true, assignedTo: { select: safeAssignedToSelect } },
      });
    }

    const restrictedUpdatePayload: Prisma.LeadUpdateManyMutationInput = {
      ...scalarFields,
      potentialLevel:
        dto.score !== undefined && dto.potentialLevel === undefined
          ? getPotentialLevel(dto.score)
          : dto.potentialLevel,
    };

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.lead.updateMany({
        where: scopeLeadWhere({ id }, actor),
        data: restrictedUpdatePayload,
      });
      if (updated.count !== 1) throw new NotFoundException("Lead não encontrado");

      return transaction.lead.findUniqueOrThrow({
        where: { id },
        include: { company: true, assignedTo: { select: safeAssignedToSelect } },
      });
    });
  }

  public async resolveProfileId(idOrCuid?: string | null): Promise<string | null> {
    if (!idOrCuid || !idOrCuid.trim()) return null;
    const cleanId = idOrCuid.trim();

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
    if (isUuid) {
      const existing = await this.prisma.profile.findUnique({ where: { id: cleanId } });
      if (existing) return existing.id;
    }

    const mapping = isUuid
      ? await this.prisma.userMapping.findUnique({ where: { uuid: cleanId } })
      : await this.prisma.userMapping.findUnique({ where: { cuid: cleanId } });
    if (mapping) {
      const mappedProfile = await this.prisma.profile.findUnique({ where: { id: mapping.uuid } });
      if (mappedProfile) return mappedProfile.id;
    }

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ id: cleanId }, { email: cleanId }] },
    });

    if (user) {
      const profile = await this.prisma.profile.upsert({
        where: { email: user.email },
        update: { name: user.name, role: user.role },
        create: {
          id: randomUUID(),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      });
      await this.prisma.userMapping.upsert({
        where: { cuid: user.id },
        update: { uuid: profile.id, email: user.email },
        create: { cuid: user.id, uuid: profile.id, email: user.email },
      });
      return profile.id;
    }

    return null;
  }

  async convert(id: string, actor: LeadAccessActor) {
    return this.prisma.$transaction(async (transaction) => {
      const lead = await transaction.lead.findFirst({
        where: scopeLeadWhere({ id }, actor),
        include: { company: true },
      });
      if (!lead) throw new NotFoundException("Lead não encontrado");

      const updated = await transaction.lead.updateMany({
        where: scopeLeadWhere({ id }, actor),
        data: { status: LeadStatus.CONVERTED, lastContactAt: new Date() },
      });
      if (updated.count !== 1) throw new NotFoundException("Lead não encontrado");

      const updatedLead = await transaction.lead.findUniqueOrThrow({
        where: { id },
        include: { company: true, assignedTo: { select: safeAssignedToSelect } },
      });

      const existingClient = await transaction.clientAccount.findFirst({
        where: { companyId: lead.companyId },
        orderBy: { createdAt: "asc" },
      });
      if (existingClient) {
        if (!existingClient.isCurrentClient) {
          await transaction.clientAccount.update({
            where: { id: existingClient.id },
            data: { isCurrentClient: true },
          });
        }
      } else {
        await transaction.clientAccount.upsert({
          where: { codigoClienteDeusa: `LEAD-${lead.companyId}` },
          update: { isCurrentClient: true, companyId: lead.companyId },
          create: {
            codigoClienteDeusa: `LEAD-${lead.companyId}`,
            companyId: lead.companyId,
            razaoSocial: lead.company.razaoSocial,
            nomeFantasia: lead.company.nomeFantasia,
            cnpj: lead.company.cnpj,
            cidade: lead.company.cidade,
            uf: lead.company.uf,
            isCurrentClient: true,
            importedFromExcel: false,
          },
        });
      }

      return updatedLead;
    });
  }

  discard(id: string, actor: LeadAccessActor) {
    return this.update(id, { status: LeadStatus.NOT_INTERESTED, lastContactAt: new Date() }, actor);
  }

  async upsertLeadForCompany(companyId: string, assignedToId?: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: { cnaes: true },
    });
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

    const assignableUsers = await Promise.all(
      salesUsers.map(async (user) => ({
        ...user,
        profileId: await this.resolveProfileId(user.id),
      })),
    );
    const usersWithProfile = assignableUsers.filter(
      (user): user is typeof user & { profileId: string } => Boolean(user.profileId),
    );
    if (usersWithProfile.length === 0) {
      return { success: false, message: "Nenhum perfil de vendedor válido foi encontrado." };
    }

    let assignedCount = 0;
    const cityMap: Record<string, string> = {};

    // Mapeamento territorial de vendedores da Deusa Alimentos por região
    for (const user of usersWithProfile) {
      const nameLower = user.name.toLowerCase();
      if (nameLower.includes("rafael")) {
        cityMap["tupã"] = user.profileId;
        cityMap["marília"] = user.profileId;
        cityMap["pompeia"] = user.profileId;
      } else if (nameLower.includes("camila")) {
        cityMap["araçatuba"] = user.profileId;
        cityMap["bauru"] = user.profileId;
        cityMap["lins"] = user.profileId;
      } else if (nameLower.includes("felipe")) {
        cityMap["ourinhos"] = user.profileId;
        cityMap["assis"] = user.profileId;
        cityMap["bastos"] = user.profileId;
      }
    }

    for (let i = 0; i < unassignedLeads.length; i++) {
      const lead = unassignedLeads[i];
      const cityClean = lead.company.cidade?.toLowerCase().trim() || "";
      const assignedId =
        cityMap[cityClean] || usersWithProfile[i % usersWithProfile.length].profileId;

      const assigned = await this.prisma.lead.updateMany({
        where: { id: lead.id, assignedToId: null },
        data: { assignedToId: assignedId },
      });
      assignedCount += assigned.count;
    }

    return {
      success: true,
      assignedCount,
      message: `${assignedCount} leads foram atribuídos automaticamente aos vendedores por região de atuação.`,
    };
  }

  private computeSpatialClusters<T extends { company: SpatialCompany }>(
    leads: T[],
    allCompanies: SpatialCompany[],
  ): Map<string, number> {
    const counts = new Map<string, number>();

    for (const lead of leads) {
      let count = 0;
      for (const comp of allCompanies) {
        if (areSpatialNeighbors(lead.company, comp)) count += 1;
      }
      counts.set(lead.company.id, count);
    }
    return counts;
  }

  private targetCnaesCache: { data: string[]; expiresAt: number } | null = null;
  private priorityCitiesCache: { data: string[]; expiresAt: number } | null = null;

  private async getTargetCnaes() {
    if (this.targetCnaesCache && this.targetCnaesCache.expiresAt > Date.now()) {
      return this.targetCnaesCache.data;
    }
    const cnaes = await this.prisma.cnae.findMany({
      where: { isTarget: true },
      select: { code: true },
    });
    const res = cnaes.map((cnae) => cnae.code);
    this.targetCnaesCache = { data: res, expiresAt: Date.now() + 60000 };
    return res;
  }

  private async getPriorityCities() {
    if (this.priorityCitiesCache && this.priorityCitiesCache.expiresAt > Date.now()) {
      return this.priorityCitiesCache.data;
    }
    const cities = await this.prisma.city.findMany({
      where: { isActive: true },
      select: { name: true },
    });
    const res = cities.map((city) => city.name);
    this.priorityCitiesCache = { data: res, expiresAt: Date.now() + 60000 };
    return res;
  }
}
