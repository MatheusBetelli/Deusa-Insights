import { ForbiddenException, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../common/geocoding.service";
import { calculateOpportunityScoreDetails } from "../common/scoring";
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
export type HeatmapPoint = {
  municipio: string;
  uf: string;
  latitude: number;
  longitude: number;
  quantidadeEmpresas: number;
  intensidade: number;
};

export type HeatmapResponse = HeatmapPoint[];

function joinSqlFragments(fragments: Prisma.Sql[], separator: Prisma.Sql): Prisma.Sql {
  if (fragments.length === 0) return Prisma.empty;
  return fragments.slice(1).reduce((sql, fragment) => Prisma.sql`${sql}${separator}${fragment}`, fragments[0]);
}

function rejectRegionalDiscovery(): void {
  throw new ForbiddenException(
    "Descoberta regional automática desativada: use somente dados locais ou correção individual autorizada.",
  );
}

@Injectable()
export class MapOpportunitiesService implements OnModuleInit {
  private readonly logger = new Logger(MapOpportunitiesService.name);
  private mapCache: { data: any; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async onModuleInit() {
    // Pré-aquecer os pontos do mapa na inicialização do backend
    setTimeout(() => {
      void this.findAll().catch(() => {});
    }, 1500);
  }

  async findAll() {
    if (this.mapCache && this.mapCache.expiresAt > Date.now()) {
      return this.mapCache.data;
    }
    // Buscar apenas leads criados explicitamente pelos fluxos de ingestão autorizados.
    const leads = await this.prisma.lead.findMany({
      where: {
        company: {
          situacaoCadastral: "ATIVA",
          ...buildCnaeWhereInput(),
        },
      },
      include: {
        company: { include: { details: true, cnaes: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { score: "desc" },
    });

    // Filtrar estritamente por geofence urbano e não-rural
    const validLeads = leads.filter((lead) => isValidOpportunity(lead.company));

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
        status: lead.status,
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
      };
    });

    this.mapCache = { data: result, expiresAt: Date.now() + 60000 };
    return result;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DESCOBERTA DE MERCADOS VIA GOOGLE PLACES (NEW)
  //
  // Busca no Google Places por estabelecimentos comerciais relevantes em uma cidade,
  // utilizando paginação (nextPageToken), busca multi-termo (8 termos) e expansão
  // territorial. Cadastra somente registros únicos e separa Place ID do CNPJ.
  // ─────────────────────────────────────────────────────────────────────────────
  async discoverRegion(cidade: string, uf: string) {
    rejectRegionalDiscovery();

    if (!this.geocodingService.isAvailable()) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY não configurada. Descoberta desativada.",
        discovered: 0,
        existing: 0,
        total: 0,
        diagnostico: null,
      };
    }

    const cidadeNorm = cidade.trim();
    const ufNorm = uf.toUpperCase().trim();
    const cidadeSemAcento = cidadeNorm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

    // Termos de busca comerciais focados EXCLUSIVAMENTE nas 5 categorias autorizadas
    const baseTerms = [
      "supermercado",
      "hipermercado",
      "minimercado",
      "mercearia",
      "açougue",
      "casa de carnes",
    ];

    // Cidades de médio/grande porte com expansão por regiões territoriais
    const largeCities = ["marilia", "marília", "bauru", "ribeirao preto", "ribeirão preto", "franca", "presidente prudente", "assis", "aracatuba", "araçatuba"];
    const isLargeCity = largeCities.some((c) => cidadeSemAcento.includes(c));

    const queries: string[] = [];
    for (const term of baseTerms) {
      queries.push(`${term} em ${cidadeNorm} ${ufNorm}`);
      if (isLargeCity && (term === "supermercado" || term === "minimercado" || term === "açougue")) {
        queries.push(`${term} centro em ${cidadeNorm} ${ufNorm}`);
        queries.push(`${term} zona norte em ${cidadeNorm} ${ufNorm}`);
        queries.push(`${term} zona sul em ${cidadeNorm} ${ufNorm}`);
      }
    }

    const placesMap = new Map<string, any>();
    let totalBrutos = 0;
    let queriesExecutadas = 0;

    for (const query of queries) {
      queriesExecutadas++;
      const results = await this.geocodingService.searchPlace(query, { maxPages: 3 });
      if (results && results.length > 0) {
        totalBrutos += results.length;
        for (const place of results) {
          if (!place.id) continue;

          // Filtra por tipo indesejado (restaurante, bar, padaria, atacadista, etc.)
          const types: string[] = place.types || [];
          const primaryType: string = place.primaryType || "";
          const isExcludedType =
            primaryType === "restaurant" ||
            primaryType === "bar" ||
            primaryType === "night_club" ||
            primaryType === "bakery" ||
            primaryType === "wholesaler" ||
            types.includes("meal_takeaway") ||
            types.includes("meal_delivery");

          if (isExcludedType) continue;

          // Filtrar apenas resultados que contêm o município no endereço formatado (tratando abreviações como Pres. Prudente)
          const addr = (place.formattedAddress || "").toLowerCase();
          const addrSemAcento = addr.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          let isCityMatch = addrSemAcento.includes(cidadeSemAcento);

          if (!isCityMatch) {
            if (cidadeSemAcento.includes("presidente prudente") && (addrSemAcento.includes("pres. prudente") || addrSemAcento.includes("pres prudente"))) {
              isCityMatch = true;
            } else if (cidadeSemAcento.includes("vera cruz") && (addrSemAcento.includes("v. cruz") || addrSemAcento.includes("v cruz"))) {
              isCityMatch = true;
            } else if (cidadeSemAcento.includes("ribeirao preto") && (addrSemAcento.includes("rib. preto") || addrSemAcento.includes("rib preto"))) {
              isCityMatch = true;
            }
          }

          if (isCityMatch) {
            if (!placesMap.has(place.id)) {
              placesMap.set(place.id, place);
            }
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    const allPlaces = Array.from(placesMap.values());
    const duplicadosRemovidos = totalBrutos - allPlaces.length;

    // Métricas para o log de diagnóstico
    let cnaePrimaryCount = 0;
    let cnaeSecondaryCount = 0;
    let semCnaeCount = 0;
    let descartadosCount = 0;
    let existingCount = 0;
    let discoveredCount = 0;
    let comCoordenadasCount = 0;
    let semCoordenadasCount = 0;

    // Busca todas as empresas já existentes no banco para a cidade
    const existingCompanies = await this.prisma.company.findMany({
      where: {
        cidade: { equals: cidadeNorm, mode: "insensitive" },
        uf: ufNorm,
      },
      select: { id: true, placeId: true, cnpj: true, nomeFantasia: true, razaoSocial: true },
    });

    const existingPlaceIds = new Set(existingCompanies.map((c) => c.placeId).filter(Boolean));

    for (const place of allPlaces) {
      const placeName = place.displayName?.text || "";
      const placeAddr = place.formattedAddress || "";
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      const phone = place.nationalPhoneNumber || null;

      const isSpBounds =
        typeof lat === "number" &&
        typeof lng === "number" &&
        lat >= -25.5 && lat <= -19.5 &&
        lng >= -53.5 && lng <= -44.0;

      if (!placeName || typeof lat !== "number" || typeof lng !== "number" || !isSpBounds) {
        semCoordenadasCount++;
        descartadosCount++;
        continue;
      }
      comCoordenadasCount++;

      // 1. Validação estrita de businessStatus (descartar fechados/inativos)
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") {
        descartadosCount++;
        continue;
      }

      // 2. Inferência rigorosa de CNAE com prioridade ABSOLUTA ao primaryType oficial do Google
      const primaryType = place.primaryType || "";
      const types: string[] = place.types || [];
      let inferredCnae = "";

      // Mapeamento estrito permitido
      if (primaryType === "supermarket") {
        inferredCnae = "4711302"; // Supermercado
        cnaePrimaryCount++;
      } else if (primaryType === "hypermarket") {
        inferredCnae = "4711301"; // Hipermercado
        cnaePrimaryCount++;
      } else if (primaryType === "grocery_store" || primaryType === "asian_grocery_store" || primaryType === "japanese_grocery_store") {
        inferredCnae = "4712100"; // Minimercado
        cnaePrimaryCount++;
      } else if (primaryType === "butcher_shop") {
        inferredCnae = "4722901"; // Açougue
        cnaePrimaryCount++;
      } else if (!primaryType && (types.includes("supermarket") || types.includes("grocery_store") || types.includes("butcher_shop"))) {
        // Fallback apenas se primaryType estiver ausente mas types contiver um tipo estrito autorizado
        if (types.includes("supermarket")) inferredCnae = "4711302";
        else if (types.includes("butcher_shop")) inferredCnae = "4722901";
        else inferredCnae = "4712100";
        cnaePrimaryCount++;
      } else {
        // ⚠️ REGRA CRÍTICA: Se primaryType for um tipo incompatível (ex: health_food_store, bakery, liquor_store, etc.)
        // ou genérico/ausente, O NOME JAMAIS CONTRADIZ O PRIMARYTYPE. Descarte imediato!
        descartadosCount++;
        continue;
      }

      if (!inferredCnae) {
        descartadosCount++;
        continue;
      }

      // Validação rigorosa se é Oportunidade Válida (perímetro urbano + não rural)
      const candidateCompany = {
        situacaoCadastral: "ATIVA",
        cnaePrincipal: inferredCnae,
        cidade: cidadeNorm,
        uf: ufNorm,
        latitude: lat,
        longitude: lng,
        nomeFantasia: placeName,
        razaoSocial: placeName,
        logradouro: placeAddr,
      };

      if (!isValidOpportunity(candidateCompany)) {
        descartadosCount++;
        continue;
      }

      // Verificação de duplicidade: por placeId OU por nome similar na mesma cidade
      let isDuplicate = existingPlaceIds.has(place.id);

      if (!isDuplicate) {
        const normalizedName = placeName
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        isDuplicate = existingCompanies.some((c) => {
          const existingName = (c.nomeFantasia || c.razaoSocial)
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          return (
            existingName === normalizedName ||
            (normalizedName.length >= 6 && existingName.length >= 6 && (existingName.includes(normalizedName) || normalizedName.includes(existingName)))
          );
        });
      }

      if (isDuplicate) {
        existingCount++;
        continue;
      }

      // Extração de logradouro/número do endereço formatado
      const addrParts = placeAddr.split(",").map((s: string) => s.trim());
      const logradouro = addrParts[0] || placeName;
      const numero = addrParts[1] || "S/N";

      // SEPARAÇÃO SEMÂNTICA: Google Place ID vai para `placeId`, e `cnpj` recebe código interno PROSPECT-
      const prospectCode = `PROSPECT-${place.id}`;

      // Cálculo de score de oportunidade
      const scoreResult = calculateOpportunityScoreDetails({
        cnpj: prospectCode,
        situacaoCadastral: "ATIVA",
        cnaePrincipal: inferredCnae,
        nomeFantasia: placeName,
        cidade: cidadeNorm,
        uf: ufNorm,
        latitude: lat,
        longitude: lng,
        logradouro,
        numero,
        telefone: phone,
      });

      try {
        const company = await this.prisma.company.create({
          data: {
            cnpj: prospectCode,
            placeId: place.id,
            razaoSocial: placeName,
            nomeFantasia: placeName,
            situacaoCadastral: "ATIVA",
            cnaePrincipal: inferredCnae,
            uf: ufNorm,
            cidade: cidadeNorm,
            logradouro,
            numero,
            latitude: lat,
            longitude: lng,
            latitudeVerificada: lat,
            longitudeVerificada: lng,
            source: "google_discovery",
            origemCoordenada: "google_places",
            statusVerificacaoEndereco: "verificado",
            confiancaVerificacao: 90,
            enderecoVerificado: placeAddr,
            fonteGeocodificacao: "google_places_v1",
            dataVerificacaoGeo: new Date(),
            enderecoCompleto: true,
            pontuacaoOportunidade: scoreResult.score,
            nivelOportunidade: scoreResult.level.toLowerCase(),
            motivoPontuacao: ["Descoberto via Google Places", `CNAE Estimado: ${inferredCnae}`, `Categoria: ${place.primaryType || "Mercado"}`],
            nomeEncontrado: placeName,
            enderecoEncontrado: placeAddr,
            telefoneEncontrado: phone,
            categoriaEncontrada: place.primaryType || "grocery_store",
          },
        });

        await this.prisma.lead.create({
          data: {
            companyId: company.id,
            score: scoreResult.score,
            potentialLevel: scoreResult.level,
            status: "NEW",
          },
        });

        if (phone) {
          await this.prisma.companyDetails.create({
            data: {
              companyId: company.id,
              telefone: phone,
              descricaoCnae: place.primaryType || "Supermercado / Mercearia",
            },
          });
        }

        discoveredCount++;
      } catch (err) {
        this.logger.warn(`Falha ao persistir ${placeName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const summaryLog = {
      cidade: cidadeNorm,
      uf: ufNorm,
      diagnostico: {
        queriesExecutadas,
        resultadosBrutos: totalBrutos,
        resultadosComPaginacao: totalBrutos,
        duplicadosRemovidos,
        resultadosUnicos: allPlaces.length,
        cnaePrimary: cnaePrimaryCount,
        cnaeSecondary: cnaeSecondaryCount,
        semCnaeInferido: semCnaeCount,
        descartados: descartadosCount,
        jaExistentesNoBanco: existingCount,
        novosPersistidos: discoveredCount,
        comCoordenadas: comCoordenadasCount,
        semCoordenadas: semCoordenadasCount,
        renderizaveisNoMapa: existingCount + discoveredCount,
      },
    };

    this.logger.log(`📊 Diagnostic Discovery Summary (${cidadeNorm}/${ufNorm}): ${JSON.stringify(summaryLog.diagnostico)}`);

    return {
      success: true,
      message: `Descoberta concluída em ${cidadeNorm}/${ufNorm}. ${discoveredCount} novo(s) mercado(s) cadastrado(s), ${existingCount} já existia(m). Total no mapa: ${existingCount + discoveredCount}.`,
      discovered: discoveredCount,
      existing: existingCount,
      total: allPlaces.length,
      diagnostico: summaryLog.diagnostico,
    };
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
    const conditions: Prisma.Sql[] = [Prisma.sql`LOWER("situacaoCadastral") = 'ativa'`];

    if (params.estado && params.estado !== "Todos") {
      conditions.push(Prisma.sql`UPPER(uf) = ${params.estado.toUpperCase()}`);
    }

    if (params.municipio && params.municipio !== "Todas") {
      conditions.push(Prisma.sql`LOWER(cidade) = LOWER(${params.municipio.trim()})`);
    }

    if (params.cnae && params.cnae !== "Todos") {
      // Normaliza o código CNAE removendo pontuação
      const cnaeNorm = params.cnae.replace(/\D/g, "");
      conditions.push(
        Prisma.sql`(REGEXP_REPLACE("cnaePrincipal", '\\\\D', '', 'g') = ${cnaeNorm}
          OR EXISTS (
            SELECT 1 FROM company_cnaes cc
            WHERE cc."companyId" = companies.id
              AND REGEXP_REPLACE(cc."cnaeCode", '\\\\D', '', 'g') = ${cnaeNorm}
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

    const whereClause = joinSqlFragments(conditions, Prisma.sql` AND `);

    // ── Consulta SQL com COUNT(DISTINCT cnpj) para deduplicação ──────────────
    // Retorna agrupado por cidade+uf com centroide médio das coordenadas válidas
    const rows = await this.prisma.$queryRaw<
      Array<{
        cidade: string;
        uf: string;
        quantidade: bigint;
        lat_media: number | null;
        lon_media: number | null;
      }>
    >(Prisma.sql`
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

    const points: HeatmapPoint[] = [];

    for (const row of rows) {
      const qtd = Number(row.quantidade);
      if (qtd === 0) continue;

      // Coordenadas: média calculada pelo banco ou fallback IBGE
      let lat = row.lat_media ?? null;
      let lon = row.lon_media ?? null;

      if (!lat || !lon) {
        const key = `${row.cidade.toLowerCase()}|${row.uf.toLowerCase()}`;
        const keyNormalized = `${row.cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}|${row.uf.toLowerCase()}`;
        const fallback = IBGE_CENTROIDES[key] || IBGE_CENTROIDES[keyNormalized];
        if (fallback) {
          lat = fallback.lat;
          lon = fallback.lon;
        }
      }

      // Pula municípios sem coordenada disponível (nem no banco nem na tabela IBGE)
      if (!lat || !lon) continue;

      points.push({
        municipio: row.cidade,
        uf: row.uf,
        latitude: parseFloat(lat.toFixed(6)),
        longitude: parseFloat(lon.toFixed(6)),
        quantidadeEmpresas: qtd,
        intensidade: parseFloat(Math.max(0.1, qtd / maxQtd).toFixed(4)),
      });
    }

    return points;
  }
}
