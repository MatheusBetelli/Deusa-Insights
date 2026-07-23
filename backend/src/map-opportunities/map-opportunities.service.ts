import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// ─────────────────────────────────────────────────────────────────────────────
// Tabela estática de centroides municipais (IBGE / OpenStreetMap)
// Usada como fallback quando o município não tem coordenadas nas empresas
// Fonte: dados públicos — sem API paga
// ─────────────────────────────────────────────────────────────────────────────
const IBGE_CENTROIDES: Record<string, { lat: number; lon: number }> = {
  // SP — Oeste Paulista
  "tupã|sp": { lat: -21.9347, lon: -50.5136 },
  "presidente prudente|sp": { lat: -22.1208, lon: -51.3882 },
  "pompeia|sp": { lat: -22.1085, lon: -50.1749 },
  "araçatuba|sp": { lat: -21.2094, lon: -50.4384 },
  "marília|sp": { lat: -22.2139, lon: -49.9467 },
  "garça|sp": { lat: -22.2131, lon: -49.6553 },
  "bastos|sp": { lat: -21.9235, lon: -50.7256 },
  "adamantina|sp": { lat: -21.6859, lon: -51.0735 },
  "lucélia|sp": { lat: -21.7199, lon: -51.0181 },
  "osvaldo cruz|sp": { lat: -21.7946, lon: -50.8795 },
  "dracena|sp": { lat: -21.4828, lon: -51.5322 },
  "assis|sp": { lat: -22.6628, lon: -50.4124 },
  "ourinhos|sp": { lat: -22.9789, lon: -49.8701 },
  "bauru|sp": { lat: -22.3246, lon: -49.0959 },
  "botucatu|sp": { lat: -22.8851, lon: -48.4454 },
  "são paulo|sp": { lat: -23.5505, lon: -46.6333 },
  "campinas|sp": { lat: -22.9099, lon: -47.0626 },
  "ribeirão preto|sp": { lat: -21.1784, lon: -47.8063 },
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
  constructor(private readonly prisma: PrismaService) {}

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
        `(REGEXP_REPLACE("cnaePrincipal", '\\D', '', 'g') = $${paramIdx}
         OR EXISTS (
           SELECT 1 FROM company_cnaes cc
           WHERE cc."companyId" = companies.id
             AND REGEXP_REPLACE(cc."cnaeCode", '\\D', '', 'g') = $${paramIdx}
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
        COUNT(DISTINCT REGEXP_REPLACE(cnpj, '\\D', '', 'g'))   AS quantidade,
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
        const fallback = IBGE_CENTROIDES[key];
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
