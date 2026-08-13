import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GeocodingService } from "../common/geocoding.service";

// ─────────────────────────────────────────────────────────────────────────────
// Tabela estática de centroides municipais (IBGE / OpenStreetMap)
// Usada como fallback quando o município não tem coordenadas nas empresas
// Fonte: dados públicos — sem API paga
// ─────────────────────────────────────────────────────────────────────────────
const IBGE_CENTROIDES: Record<string, { lat: number; lon: number }> = {
  // SP — Marília, Tupã, Alta Paulista e Região
  "tupã|sp": { lat: -21.9347, lon: -50.5136 },
  "tupa|sp": { lat: -21.9347, lon: -50.5136 },
  "presidente prudente|sp": { lat: -22.1208, lon: -51.3882 },
  "pompeia|sp": { lat: -22.1085, lon: -50.1749 },
  "pompéia|sp": { lat: -22.1085, lon: -50.1749 },
  "araçatuba|sp": { lat: -21.2094, lon: -50.4384 },
  "aracatuba|sp": { lat: -21.2094, lon: -50.4384 },
  "marília|sp": { lat: -22.2139, lon: -49.9467 },
  "marilia|sp": { lat: -22.2139, lon: -49.9467 },
  "garça|sp": { lat: -22.2131, lon: -49.6553 },
  "garca|sp": { lat: -22.2131, lon: -49.6553 },
  "quintana|sp": { lat: -22.0722, lon: -50.3125 },
  "vera cruz|sp": { lat: -22.2225, lon: -49.8211 },
  "oriente|sp": { lat: -22.1558, lon: -49.9961 },
  "echaporã|sp": { lat: -22.4294, lon: -50.2106 },
  "echapora|sp": { lat: -22.4294, lon: -50.2106 },
  "herculândia|sp": { lat: -21.9744, lon: -50.3806 },
  "herculandia|sp": { lat: -21.9744, lon: -50.3806 },
  "iacri|sp": { lat: -21.8586, lon: -50.6881 },
  "parapuã|sp": { lat: -21.7778, lon: -50.8447 },
  "parapua|sp": { lat: -21.7778, lon: -50.8447 },
  "rinópolis|sp": { lat: -21.7247, lon: -50.7192 },
  "rinopolis|sp": { lat: -21.7247, lon: -50.7192 },
  "gália|sp": { lat: -22.2889, lon: -49.5544 },
  "galia|sp": { lat: -22.2889, lon: -49.5544 },
  "bastos|sp": { lat: -21.9235, lon: -50.7256 },
  "adamantina|sp": { lat: -21.6859, lon: -51.0735 },
  "lucélia|sp": { lat: -21.7199, lon: -51.0181 },
  "lucelia|sp": { lat: -21.7199, lon: -51.0181 },
  "osvaldo cruz|sp": { lat: -21.7946, lon: -50.8795 },
  "dracena|sp": { lat: -21.4828, lon: -51.5322 },
  "assis|sp": { lat: -22.6628, lon: -50.4124 },
  "ourinhos|sp": { lat: -22.9789, lon: -49.8701 },
  "lins|sp": { lat: -21.6786, lon: -49.7503 },
  "bauru|sp": { lat: -22.3246, lon: -49.0959 },
  "botucatu|sp": { lat: -22.8851, lon: -48.4454 },
  "são paulo|sp": { lat: -23.5505, lon: -46.6333 },
  "sao paulo|sp": { lat: -23.5505, lon: -46.6333 },
  "campinas|sp": { lat: -22.9099, lon: -47.0626 },
  "ribeirão preto|sp": { lat: -21.1784, lon: -47.8063 },
  "ribeirao preto|sp": { lat: -21.1784, lon: -47.8063 },
  "franca|sp": { lat: -20.5386, lon: -47.4008 },
};

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

@Injectable()
export class MapOpportunitiesService {
  private readonly logger = new Logger(MapOpportunitiesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geocodingService: GeocodingService,
  ) {}

  async findAll() {
    // 1. Garantir que empresas ativas sem lead associado recebam um lead padrão
    const companiesWithoutLead = await this.prisma.company.findMany({
      where: {
        situacaoCadastral: "ATIVA",
        lead: { is: null },
      },
      select: { id: true, pontuacaoOportunidade: true, nivelOportunidade: true },
    });

    if (companiesWithoutLead.length > 0) {
      for (const c of companiesWithoutLead) {
        await this.prisma.lead.create({
          data: {
            companyId: c.id,
            score: c.pontuacaoOportunidade ?? 70,
            potentialLevel: c.nivelOportunidade === "critica" ? "CRITICAL" : c.nivelOportunidade === "alta" ? "HIGH" : c.nivelOportunidade === "media" ? "MEDIUM" : "LOW",
            status: "NEW",
          },
        }).catch(() => null);
      }
    }

    // 2. Buscar TODOS os leads com empresas ativas (situacaoCadastral = ATIVA)
    const leads = await this.prisma.lead.findMany({
      where: {
        company: {
          situacaoCadastral: "ATIVA",
        },
      },
      include: {
        company: { include: { details: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { score: "desc" },
    });

    // 3. Mapear para exibição no mapa, aplicando fallback de centroide se lat/lon forem nulas ou divergentes
    return leads.map((lead) => {
      let lat = lead.company.latitude;
      let lng = lead.company.longitude;
      let origemCoordenada = lead.company.origemCoordenada;
      let confiancaVerificacao = lead.company.confiancaVerificacao ?? 70;

      // Se o status da verificação for divergente ou a confiança for baixa (< 60), descartar coordenadas físicas suspeitas
      const isDivergent =
        lead.company.statusVerificacaoEndereco === "divergente" ||
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
        responsibleName: lead.assignedTo?.name || "Não atribuído",
      };
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // DESCOBERTA DE MERCADOS VIA GOOGLE PLACES (NEW)
  //
  // Busca no Google Places por supermercados/mercearias em uma cidade e cadastra
  // automaticamente os que ainda não existem no banco como novos leads.
  // ─────────────────────────────────────────────────────────────────────────────
  async discoverRegion(cidade: string, uf: string) {
    if (!this.geocodingService.isAvailable()) {
      return {
        success: false,
        message: "GOOGLE_MAPS_API_KEY não configurada. Descoberta desativada.",
        discovered: 0,
        existing: 0,
        total: 0,
      };
    }

    const queries = [
      `supermercado em ${cidade} ${uf}`,
      `minimercado em ${cidade} ${uf}`,
      `mercearia em ${cidade} ${uf}`,
      `açougue em ${cidade} ${uf}`,
      `hortifruti em ${cidade} ${uf}`,
      `armazém em ${cidade} ${uf}`,
    ];

    // Deduplica resultados por place id
    const placesMap = new Map<string, any>();

    for (const query of queries) {
      const results = await this.geocodingService.searchPlace(query);
      if (results) {
        for (const place of results) {
          if (place.id && !placesMap.has(place.id)) {
            // Filtrar apenas resultados que contêm a cidade no endereço
            const addr = (place.formattedAddress || "").toLowerCase();
            if (addr.includes(cidade.toLowerCase())) {
              placesMap.set(place.id, place);
            }
          }
        }
      }
      // Rate limit entre queries
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const allPlaces = Array.from(placesMap.values());
    let discovered = 0;
    let existing = 0;

    for (const place of allPlaces) {
      const placeName = place.displayName?.text || "";
      const placeAddr = place.formattedAddress || "";
      const lat = place.location?.latitude;
      const lng = place.location?.longitude;
      const phone = place.nationalPhoneNumber || null;

      if (!placeName || !lat || !lng) continue;

      // Verifica se já existe no banco (por nome parecido + mesma cidade)
      const normalizedName = placeName
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const existingCompanies = await this.prisma.company.findMany({
        where: {
          cidade: { equals: cidade, mode: "insensitive" },
          uf: uf.toUpperCase(),
        },
        select: { id: true, nomeFantasia: true, razaoSocial: true },
      });

      const alreadyExists = existingCompanies.some((c) => {
        const existingName = (c.nomeFantasia || c.razaoSocial)
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/[^a-z0-9]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        return (
          existingName.includes(normalizedName) ||
          normalizedName.includes(existingName) ||
          (normalizedName.length >= 5 &&
            existingName.length >= 5 &&
            normalizedName.substring(0, 8) === existingName.substring(0, 8))
        );
      });

      if (alreadyExists) {
        existing++;
        continue;
      }

      // Extrair logradouro/número do endereço formatado do Google
      const addrParts = placeAddr.split(",").map((s: string) => s.trim());
      const logradouro = addrParts[0] || placeName;
      const numero = addrParts[1] || "S/N";

      try {
        // Criar empresa
        const company = await this.prisma.company.create({
          data: {
            cnpj: `GOOGLE-${place.id.substring(0, 20)}`,
            razaoSocial: placeName,
            nomeFantasia: placeName,
            situacaoCadastral: "ATIVA",
            uf: uf.toUpperCase(),
            cidade,
            logradouro,
            numero,
            latitude: lat,
            longitude: lng,
            source: "google_discovery",
            origemCoordenada: "google_places",
            statusVerificacaoEndereco: "verificado",
            confiancaVerificacao: 90,
            enderecoVerificado: placeAddr,
            fonteGeocodificacao: "google_places_v1",
            dataVerificacaoGeo: new Date(),
            enderecoCompleto: true,
            pontuacaoOportunidade: 80,
            nivelOportunidade: "alta",
            motivoPontuacao: ["Descoberto via Google Places", "Localização verificada"],
            placeId: place.id,
            nomeEncontrado: placeName,
            enderecoEncontrado: placeAddr,
            telefoneEncontrado: phone,
            categoriaEncontrada: place.primaryType || "grocery_store",
          },
        });

        // Criar lead para a empresa
        await this.prisma.lead.create({
          data: {
            companyId: company.id,
            score: 80,
            potentialLevel: "HIGH",
            status: "NEW",
          },
        });

        // Salvar telefone em company_details se disponível
        if (phone) {
          await this.prisma.companyDetails.create({
            data: {
              companyId: company.id,
              telefone: phone,
              descricaoCnae: place.primaryType || "Supermercado / Mercearia",
            },
          });
        }

        discovered++;
        this.logger.log(`📍 Novo mercado descoberto: ${placeName} (${cidade}/${uf})`);
      } catch (err) {
        // Ignora erros de duplicação (CNPJ unique constraint)
        this.logger.warn(`Erro ao cadastrar ${placeName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return {
      success: true,
      message: `Descoberta concluída em ${cidade}/${uf}. ${discovered} novo(s) mercado(s) encontrado(s) e cadastrado(s).`,
      discovered,
      existing,
      total: allPlaces.length,
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
    const conditions: string[] = [`LOWER("situacaoCadastral") = 'ativa'`];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const values: any[] = [];
    let paramIdx = 1;

    if (params.estado && params.estado !== "Todos") {
      conditions.push(`UPPER(uf) = $${paramIdx++}`);
      values.push(params.estado.toUpperCase());
    }

    if (params.municipio && params.municipio !== "Todas") {
      conditions.push(`LOWER(cidade) = LOWER($${paramIdx++})`);
      values.push(params.municipio.trim());
    }

    if (params.cnae && params.cnae !== "Todos") {
      // Normaliza o código CNAE removendo pontuação
      const cnaeNorm = params.cnae.replace(/\D/g, "");
      conditions.push(
        `(REGEXP_REPLACE("cnaePrincipal", '\\\\D', '', 'g') = $${paramIdx}
         OR EXISTS (
           SELECT 1 FROM company_cnaes cc
           WHERE cc."companyId" = companies.id
             AND REGEXP_REPLACE(cc."cnaeCode", '\\\\D', '', 'g') = $${paramIdx}
         ))`,
      );
      values.push(cnaeNorm);
      paramIdx++;
    }

    const whereClause = conditions.join(" AND ");

    // ── Consulta SQL com COUNT(DISTINCT cnpj) para deduplicação ──────────────
    // Retorna agrupado por cidade+uf com centroide médio das coordenadas válidas
    const rows = await this.prisma.$queryRawUnsafe<
      Array<{
        cidade: string;
        uf: string;
        quantidade: bigint;
        lat_media: number | null;
        lon_media: number | null;
      }>
    >(
      `
      SELECT
        TRIM(cidade)                                           AS cidade,
        UPPER(TRIM(uf))                                        AS uf,
        COUNT(DISTINCT REGEXP_REPLACE(cnpj, '\\\\D', '', 'g'))   AS quantidade,
        AVG(CASE WHEN latitude  IS NOT NULL AND latitude  <> 0 THEN latitude  END) AS lat_media,
        AVG(CASE WHEN longitude IS NOT NULL AND longitude <> 0 THEN longitude END) AS lon_media
      FROM companies
      WHERE ${whereClause}
        AND cidade IS NOT NULL
        AND uf    IS NOT NULL
      GROUP BY TRIM(cidade), UPPER(TRIM(uf))
      ORDER BY quantidade DESC
      `,
      ...values,
    );

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
