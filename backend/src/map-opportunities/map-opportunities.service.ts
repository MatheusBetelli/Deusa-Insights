import { Injectable } from "@nestjs/common";
import { LeadStatus, PotentialLevel, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  buildLeadAccessWhere,
  leadAccessCacheKey,
  LeadAccessActor,
} from "../common/lead-access.policy";
import {
  buildCnaeWhereInput,
  isValidOpportunity,
  isValidOpportunityCnae,
  TARGET_OPPORTUNITY_CNAES,
  IBGE_CENTROIDES,
} from "../common/opportunity-filter";

export type HeatmapQueryParams = {
  estado?: string;
  municipio?: string;
  cnae?: string;
};

export type MapOpportunityQueryParams = {
  uf?: string;
  city?: string;
  search?: string;
  companyId?: string;
  cnae?: string;
  potentialLevel?: PotentialLevel;
  bbox?: string;
  minScore?: number;
  client?: boolean;
};

// Estrutura exata retornada pelo endpoint GET /map/heatmap
type HeatmapPoint = {
  municipio: string;
  uf: string;
  latitude: number;
  longitude: number;
  quantidadeEmpresas: number;
  intensidade: number;
};

type HeatmapRow = {
  cidade: string;
  uf: string;
  quantidade: bigint;
  lat_media: number | null;
  lon_media: number | null;
};

export type HeatmapResponse = HeatmapPoint[];

type MapOpportunityPoint = {
  id: string;
  companyId: string;
  companyName: string;
  cnpj: string | null;
  city: string;
  uf: string;
  bairro: string | null;
  logradouro: string | null;
  numero: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  score: number;
  status: string;
  isClient: boolean;
  potentialLevel: string;
  origemCoordenada: string | null;
  statusVerificacaoEndereco: string | null;
  confiancaVerificacao: number | null;
  telefone: string | null;
  email: string | null;
  cnaePrincipal: string | null;
  responsibleName: string | null;
  scoreReasons?: string[];
};

type ParsedBbox = {
  west: number;
  south: number;
  east: number;
  north: number;
};

function joinSqlFragments(fragments: Prisma.Sql[], separator: Prisma.Sql): Prisma.Sql {
  if (fragments.length === 0) return Prisma.empty;
  return fragments
    .slice(1)
    .reduce((sql, fragment) => Prisma.sql`${sql}${separator}${fragment}`, fragments[0]);
}

function buildHeatmapConditions(params: HeatmapQueryParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [Prisma.sql`LOWER("situacaoCadastral") = 'ativa'`];
  if (params.estado && params.estado !== "Todos") {
    conditions.push(Prisma.sql`UPPER(uf) = ${params.estado.toUpperCase()}`);
  }
  if (params.municipio && params.municipio !== "Todas") {
    conditions.push(Prisma.sql`LOWER(cidade) = LOWER(${params.municipio.trim()})`);
  }

  const cnae = params.cnae && params.cnae !== "Todos" ? params.cnae.replace(/\D/g, "") : null;
  if (cnae) {
    conditions.push(
      Prisma.sql`(REGEXP_REPLACE("cnaePrincipal", '\\\\D', '', 'g') = ${cnae}
        OR EXISTS (
          SELECT 1 FROM company_cnaes cc
          WHERE cc."companyId" = companies.id
            AND REGEXP_REPLACE(cc."cnaeCode", '\\\\D', '', 'g') = ${cnae}
        ))`,
    );
  } else {
    conditions.push(
      Prisma.sql`(REGEXP_REPLACE("cnaePrincipal", '\\\\D', '', 'g') IN (${Prisma.join(Array.from(TARGET_OPPORTUNITY_CNAES))})
        OR EXISTS (
          SELECT 1 FROM company_cnaes cc
          WHERE cc."companyId" = companies.id
            AND REGEXP_REPLACE(cc."cnaeCode", '\\\\D', '', 'g') IN (${Prisma.join(Array.from(TARGET_OPPORTUNITY_CNAES))})
        ))`,
    );
  }
  return conditions;
}

function parseBbox(bbox?: string): ParsedBbox | null {
  if (!bbox) return null;
  const parts = bbox.split(",").map((value) => Number(value.trim()));
  if (parts.length !== 4 || parts.some((value) => Number.isNaN(value))) return null;
  const [west, south, east, north] = parts;
  if (south > north || west > east) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  return { west, south, east, north };
}

function buildCompanySearch(search?: string): Prisma.CompanyWhereInput | undefined {
  const term = search?.trim();
  if (!term) return undefined;

  const or: Prisma.CompanyWhereInput[] = [
    { razaoSocial: { contains: term, mode: "insensitive" } },
    { nomeFantasia: { contains: term, mode: "insensitive" } },
    { cidade: { contains: term, mode: "insensitive" } },
    { bairro: { contains: term, mode: "insensitive" } },
    { logradouro: { contains: term, mode: "insensitive" } },
  ];
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 3) or.push({ cnpj: { contains: digits } });
  return { OR: or };
}

function buildMapWhere(
  actor: LeadAccessActor,
  params: MapOpportunityQueryParams,
): Prisma.LeadWhereInput {
  const recordId = params.companyId?.trim();
  if (recordId) {
    const cnpj = recordId.replace(/\D/g, "");
    const recordOr: Prisma.LeadWhereInput[] = [
      { id: recordId },
      { companyId: recordId },
    ];
    if (cnpj.length >= 3) recordOr.push({ company: { cnpj: cnpj } });
    return {
      AND: [buildLeadAccessWhere(actor), { OR: recordOr }],
    };
  }

  const companyAnd: Prisma.CompanyWhereInput[] = [
    { situacaoCadastral: "ATIVA" },
    buildCnaeWhereInput(params.cnae),
  ];

  if (params.uf && params.uf !== "Todos") {
    companyAnd.push({ uf: params.uf.toUpperCase() });
  }
  if (params.city && params.city !== "Todas") {
    companyAnd.push({ cidade: { equals: params.city, mode: "insensitive" } });
  }
  if (params.client === true) {
    companyAnd.push({ clientAccounts: { some: { isCurrentClient: true } } });
  } else if (params.client === false) {
    companyAnd.push({ clientAccounts: { none: { isCurrentClient: true } } });
  }

  const bbox = parseBbox(params.bbox);
  if (bbox) {
    companyAnd.push({
      latitude: { gte: bbox.south, lte: bbox.north },
      longitude: { gte: bbox.west, lte: bbox.east },
    });
  }

  const search = buildCompanySearch(params.search);
  if (search) companyAnd.push(search);

  return {
    AND: [buildLeadAccessWhere(actor), { company: { AND: companyAnd } }],
    status: { notIn: [LeadStatus.NOT_INTERESTED, LeadStatus.INACTIVE] },
    potentialLevel: params.potentialLevel,
    score: params.minScore !== undefined ? { gte: params.minScore } : undefined,
  };
}

function selectPhone(company: {
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

function selectEmail(company: {
  details?: { email?: string | null } | null;
  contacts?: Array<{ type: string; value: string; active: boolean; isPrimary: boolean }>;
}) {
  const contact =
    company.contacts
      ?.filter((item) => item.active && item.type === "EMAIL")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))[0] ?? null;
  return contact?.value || company.details?.email || null;
}

function resolveHeatmapCoordinates(
  row: HeatmapRow,
): { latitude: number; longitude: number } | null {
  if (row.lat_media && row.lon_media) {
    return { latitude: row.lat_media, longitude: row.lon_media };
  }
  const key = `${row.cidade.toLowerCase()}|${row.uf.toLowerCase()}`;
  const keyNormalized = `${row.cidade
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()}|${row.uf.toLowerCase()}`;
  const fallback = IBGE_CENTROIDES[key] || IBGE_CENTROIDES[keyNormalized];
  return fallback ? { latitude: fallback.lat, longitude: fallback.lon } : null;
}

function toHeatmapPoint(row: HeatmapRow, maxQuantity: number): HeatmapPoint | null {
  const quantity = Number(row.quantidade);
  if (quantity === 0) return null;
  const coordinates = resolveHeatmapCoordinates(row);
  if (!coordinates) return null;

  return {
    municipio: row.cidade,
    uf: row.uf,
    latitude: parseFloat(coordinates.latitude.toFixed(6)),
    longitude: parseFloat(coordinates.longitude.toFixed(6)),
    quantidadeEmpresas: quantity,
    intensidade: parseFloat(Math.max(0.1, quantity / maxQuantity).toFixed(4)),
  };
}

const BRAND_STOP_WORDS = new Set([
  "ltda",
  "me",
  "eireli",
  "s/a",
  "sa",
  "supermercados",
  "supermercado",
  "minimercado",
  "mini-mercado",
  "mercado",
  "acougue",
  "mercearia",
  "comercio",
  "alimentos",
  "produtos",
  "loja",
  "unidade",
  "bastos",
  "tupa",
  "marilia",
  "lins",
  "franca",
  "garca",
  "ourinhos",
  "assis",
  "pp",
  "presidente",
  "prudente",
  "botucatu",
  "araraquara",
  "sao",
  "paulo",
  "sp",
]);

function extractBrandTokens(text?: string | null): string[] {
  if (!text) return [];
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  const words = normalized.split(/\s+/);
  const filtered = words.filter((w) => w.length >= 3 && !BRAND_STOP_WORDS.has(w));
  return Array.from(new Set(filtered));
}

function sharesBrandOrPhone(
  compA: { razaoSocial?: string | null; nomeFantasia?: string | null; nomeEncontrado?: string | null; telefoneEncontrado?: string | null },
  compB: { razaoSocial?: string | null; nomeFantasia?: string | null; nomeEncontrado?: string | null; telefoneEncontrado?: string | null },
): boolean {
  const phoneA = compA.telefoneEncontrado?.replace(/\D/g, "");
  const phoneB = compB.telefoneEncontrado?.replace(/\D/g, "");
  if (phoneA && phoneB && phoneA.length >= 8 && phoneA === phoneB) {
    return true;
  }

  const tokensA = new Set([
    ...extractBrandTokens(compA.razaoSocial),
    ...extractBrandTokens(compA.nomeFantasia),
    ...extractBrandTokens(compA.nomeEncontrado),
  ]);
  const tokensB = new Set([
    ...extractBrandTokens(compB.razaoSocial),
    ...extractBrandTokens(compB.nomeFantasia),
    ...extractBrandTokens(compB.nomeEncontrado),
  ]);

  for (const token of tokensA) {
    if (tokensB.has(token)) return true;
  }
  return false;
}

function findDuplicateLeadIndex<
  T extends {
    company: {
      cidade?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      razaoSocial?: string | null;
      nomeFantasia?: string | null;
      nomeEncontrado?: string | null;
      telefoneEncontrado?: string | null;
    };
  },
>(lead: T, validLeads: T[]): number {
  const comp = lead.company;
  const city = (comp.cidade || "").toLowerCase().trim();
  if (!comp.latitude || !comp.longitude) return -1;

  return validLeads.findIndex((existingItem) => {
    const existingComp = existingItem.company;
    const existingCity = (existingComp.cidade || "").toLowerCase().trim();
    if (city !== existingCity || !existingComp.latitude || !existingComp.longitude) {
      return false;
    }

    const latDiff = Math.abs(comp.latitude! - existingComp.latitude);
    const lonDiff = Math.abs(comp.longitude! - existingComp.longitude);
    if (latDiff > 0.0015 || lonDiff > 0.0015) return false;

    return sharesBrandOrPhone(comp, existingComp);
  });
}

function deduplicateValidLeads<
  T extends {
    score?: number | null;
    company: {
      cidade?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      razaoSocial?: string | null;
      nomeFantasia?: string | null;
      nomeEncontrado?: string | null;
      telefoneEncontrado?: string | null;
      clientAccounts: Array<{ isCurrentClient: boolean }>;
    };
  },
>(rawValidLeads: T[]): T[] {
  const validLeads: T[] = [];

  for (const lead of rawValidLeads) {
    const comp = lead.company;
    if (!comp.latitude || !comp.longitude) {
      validLeads.push(lead);
      continue;
    }

    const isClient = comp.clientAccounts.some((account) => account.isCurrentClient);
    const duplicateIdx = findDuplicateLeadIndex(lead, validLeads);

    if (duplicateIdx !== -1) {
      const existingItem = validLeads[duplicateIdx];
      const existingIsClient = existingItem.company.clientAccounts.some(
        (account) => account.isCurrentClient,
      );

      const shouldReplace =
        (isClient && !existingIsClient) ||
        (!isClient && !existingIsClient && (lead.score ?? 0) > (existingItem.score ?? 0));

      if (shouldReplace) {
        validLeads[duplicateIdx] = lead;
      }
      continue;
    }

    validLeads.push(lead);
  }

  return validLeads;
}

@Injectable()
export class MapOpportunitiesService {
  private mapCache = new Map<string, { data: MapOpportunityPoint[]; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    actor: LeadAccessActor,
    params: MapOpportunityQueryParams = {},
  ): Promise<MapOpportunityPoint[]> {
    const cacheKey = `${leadAccessCacheKey(actor)}:${JSON.stringify(params)}`;
    const cached = this.mapCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
    // Buscar apenas leads ativos criados pelos fluxos autorizados.
    const leads = await this.prisma.lead.findMany({
      where: buildMapWhere(actor, params),
      include: {
        company: { include: { details: true, contacts: true, cnaes: true, clientAccounts: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { score: "desc" },
    });

    // Filtrar estritamente por geofence urbano e não-rural
    const rawValidLeads = leads.filter(
      (lead) =>
        lead.status !== "NOT_INTERESTED" &&
        lead.status !== "INACTIVE" &&
        isValidOpportunity(lead.company),
    );

    // Deduplicação inteligente automática em tempo de execução (impede pinos duplicados no mesmo local)
    const validLeads = deduplicateValidLeads(rawValidLeads);

    // Mapear para exibição no mapa, aplicando fallback de centroide se lat/lon forem nulas ou divergentes
    const result = validLeads.map((lead) => {
      let lat = lead.company.latitude;
      let lng = lead.company.longitude;
      let origemCoordenada = lead.company.origemCoordenada;
      let confiancaVerificacao = lead.company.confiancaVerificacao;

      // Se o status da verificação for divergente ou as coordenadas estiverem fora da região das 26 cidades monitoradas em SP (-23.10 a -20.10 lat, -51.90 a -47.10 lon)
      const isOutOfSpBounds =
        typeof lat === "number" &&
        typeof lng === "number" &&
        (lat > -20.1 || lat < -23.1 || lng > -47.1 || lng < -51.9);

      const isDivergent =
        lead.company.statusVerificacaoEndereco === "divergente" ||
        isOutOfSpBounds ||
        (typeof lead.company.confiancaVerificacao === "number" &&
          lead.company.confiancaVerificacao < 60 &&
          lead.company.origemCoordenada === "geocodificado");

      if (isDivergent) {
        lat = null;
        lng = null;
      }

      if (
        (typeof lat !== "number" || typeof lng !== "number") &&
        lead.company.cidade &&
        lead.company.uf
      ) {
        const key = `${lead.company.cidade.toLowerCase()}|${lead.company.uf.toLowerCase()}`;
        const keyNorm = `${lead.company.cidade
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()}|${lead.company.uf.toLowerCase()}`;
        const centroid = IBGE_CENTROIDES[key] || IBGE_CENTROIDES[keyNorm];
        if (centroid) {
          lat = centroid.lat;
          lng = centroid.lon;
          origemCoordenada = "municipio_centroide_jitter";
          confiancaVerificacao = 50;
        }
      }

      const hasActiveClientAccount = Boolean(
        lead.company.clientAccounts.some((account) => account.isCurrentClient === true),
      );

      const isClient = hasActiveClientAccount;

      return {
        id: lead.id,
        companyId: lead.companyId,
        companyName: lead.company.nomeFantasia || lead.company.razaoSocial,
        cnpj: lead.company.cnpj,
        city: lead.company.cidade,
        uf: lead.company.uf,
        bairro: lead.company.bairro,
        logradouro: lead.company.logradouro,
        numero: lead.company.numero,
        cep: lead.company.cep,
        latitude: lat,
        longitude: lng,
        score: lead.score,
        status: isClient ? "CONVERTED" : lead.status,
        isClient,
        potentialLevel: lead.potentialLevel,
        origemCoordenada,
        statusVerificacaoEndereco: lead.company.statusVerificacaoEndereco,
        confiancaVerificacao,
        telefone: selectPhone(lead.company),
        email: selectEmail(lead.company),
        cnaePrincipal:
          (isValidOpportunityCnae(lead.company.cnaePrincipal)
            ? lead.company.cnaePrincipal
            : lead.company.cnaes.find((item) => isValidOpportunityCnae(item.cnaeCode))?.cnaeCode) ||
          null,
        responsibleName: lead.assignedTo?.name || null,
      };
    });

    this.mapCache.set(cacheKey, { data: result, expiresAt: Date.now() + 60000 });
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAPA DE CALOR REGIONAL
  //
  // Regras:
  //  1. Lê somente registros reais existentes no banco (tabela: companies)
  //  2. Normaliza CNPJ, CNAE, município, UF e situação cadastral
  //  3. Considera somente empresas com situacaoCadastral = 'ATIVA'
  //  4. Deduplica CNPJ antes de contabilizar (COUNT DISTINCT)
  //  5. Agrupa por município (cidade + uf)
  //  6. Associa cada município às suas coordenadas centrais
  //  7. Calcula intensidade regional pelo número de empresas ativas
  //  8. Retorna array de HeatmapPoint — sem dependência de validação manual
  // ─────────────────────────────────────────────────────────────────────────────
  async getHeatmapData(params: HeatmapQueryParams): Promise<HeatmapResponse> {
    // ── Monta condições WHERE dinamicamente ──────────────────────────────────
    const conditions = buildHeatmapConditions(params);
    const whereClause = joinSqlFragments(conditions, Prisma.sql` AND `);

    // ── Consulta SQL com COUNT(DISTINCT cnpj) para deduplicação ──────────────
    // Retorna agrupado por cidade+uf com centroide médio das coordenadas válidas
    const rows = await this.prisma.$queryRaw<HeatmapRow[]>(Prisma.sql`
      SELECT
        TRIM(cidade)                                           AS cidade,
        UPPER(TRIM(uf))                                        AS uf,
        COUNT(DISTINCT COALESCE(NULLIF(REGEXP_REPLACE(cnpj, '\\\\D', '', 'g'), ''), id)) AS quantidade,
        AVG(CASE WHEN latitude  IS NOT NULL AND latitude  <> 0 THEN latitude  END) AS lat_media,
        AVG(CASE WHEN longitude IS NOT NULL AND longitude <> 0 THEN longitude END) AS lon_media
      FROM companies
      WHERE ${whereClause}
        AND cidade IS NOT NULL
        AND uf    IS NOT NULL
      GROUP BY TRIM(cidade), UPPER(TRIM(uf))
      ORDER BY quantidade DESC
      `);

    if (rows.length === 0) return [];

    // ── Normaliza intensidade (0.1 – 1.0) ────────────────────────────────────
    const maxQtd = Math.max(...rows.map((r) => Number(r.quantidade)));

    return rows
      .map((row) => toHeatmapPoint(row, maxQtd))
      .filter((point): point is HeatmapPoint => point !== null);
  }
}
