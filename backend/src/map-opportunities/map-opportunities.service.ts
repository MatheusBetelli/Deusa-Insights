import { Injectable, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
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
};

function joinSqlFragments(fragments: Prisma.Sql[], separator: Prisma.Sql): Prisma.Sql {
  if (fragments.length === 0) return Prisma.empty;
  return fragments.slice(1).reduce((sql, fragment) => Prisma.sql`${sql}${separator}${fragment}`, fragments[0]);
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

function resolveHeatmapCoordinates(row: HeatmapRow): { latitude: number; longitude: number } | null {
  if (row.lat_media && row.lon_media) {
    return { latitude: row.lat_media, longitude: row.lon_media };
  }
  const key = `${row.cidade.toLowerCase()}|${row.uf.toLowerCase()}`;
  const keyNormalized = `${row.cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}|${row.uf.toLowerCase()}`;
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

@Injectable()
export class MapOpportunitiesService implements OnModuleInit {
  private mapCache: { data: MapOpportunityPoint[]; expiresAt: number } | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Pré-aquecer os pontos do mapa na inicialização do backend
    setTimeout(() => {
      void this.findAll().catch(() => {});
    }, 1500);
  }

  async findAll(): Promise<MapOpportunityPoint[]> {
    if (this.mapCache && this.mapCache.expiresAt > Date.now()) {
      return this.mapCache.data;
    }
    // Buscar apenas leads ativos criados pelos fluxos autorizados.
    const leads = await this.prisma.lead.findMany({
      where: {
        status: { notIn: ["NOT_INTERESTED", "INACTIVE"] },
        company: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
      },
      include: {
        company: { include: { details: true, cnaes: true, clientAccounts: true } },
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
    const validLeads: typeof leads = [];
    const seenLocations = new Map<string, { id: string; isClient: boolean }>();

    for (const lead of rawValidLeads) {
      const comp = lead.company;
      if (!comp.latitude || !comp.longitude) {
        validLeads.push(lead);
        continue;
      }

      const isClient = comp.clientAccounts.some((account) => account.isCurrentClient);
      const nameNorm = (comp.razaoSocial || comp.nomeFantasia || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(ltda|me|eireli|s\/a|sa|supermercados|supermercado|minimercado|mini-mercado|mercado|acougue|mercearia)\b/g, "")
        .replace(/[^a-z0-9]/g, "")
        .trim();

      const city = (comp.cidade || "").toLowerCase().trim();
      const locKey = `${city}|${comp.latitude.toFixed(4)},${comp.longitude.toFixed(4)}|${nameNorm}`;

      const existing = seenLocations.get(locKey);
      if (existing) {
        if (isClient && !existing.isClient) {
          const prevIdx = validLeads.findIndex((item) => item.company.id === existing.id);
          if (prevIdx !== -1) validLeads.splice(prevIdx, 1);
          validLeads.push(lead);
          seenLocations.set(locKey, { id: comp.id, isClient: true });
        }
        continue;
      }

      seenLocations.set(locKey, { id: comp.id, isClient: !!isClient });
      validLeads.push(lead);
    }

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
        (lat > -20.10 || lat < -23.10 || lng > -47.10 || lng < -51.90);

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

      if ((typeof lat !== "number" || typeof lng !== "number") && lead.company.cidade && lead.company.uf) {
        const key = `${lead.company.cidade.toLowerCase()}|${lead.company.uf.toLowerCase()}`;
        const keyNorm = `${lead.company.cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}|${lead.company.uf.toLowerCase()}`;
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
        telefone: lead.company.details?.telefone || lead.company.telefoneEncontrado || null,
        email: lead.company.details?.email || null,
        cnaePrincipal:
          (isValidOpportunityCnae(lead.company.cnaePrincipal)
            ? lead.company.cnaePrincipal
            : lead.company.cnaes.find((item) => isValidOpportunityCnae(item.cnaeCode))?.cnaeCode) || null,
        responsibleName: lead.assignedTo?.name || null,
      };
    });

    this.mapCache = { data: result, expiresAt: Date.now() + 60000 };
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
