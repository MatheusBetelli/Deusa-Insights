/**
 * ReceitaFederalProvider
 *
 * Lê o CSV real da Receita Federal (layout ESTABELE) e mapeia os dados para
 * o formato interno ExternalCompany.
 *
 * IMPORTANTE sobre coordenadas:
 * - Este arquivo CSV NÃO contém latitude/longitude dos estabelecimentos.
 * - As coordenadas são geradas a partir do centroide do município + jitter
 *   determinístico baseado no CNPJ (evita que o mesmo ponto mude a cada reload).
 * - Toda coordenada gerada aqui é classificada como "municipio_centroide_jitter"
 *   e NUNCA deve ser tratada como endereço real do estabelecimento.
 * - statusVerificacaoEndereco será sempre "aproximado" para esses casos.
 *
 * CACHE EM MEMÓRIA (MVP):
 * - O CSV é carregado uma vez e indexado por código TOM de município.
 * - Evolução ideal: importar os dados para o banco PostgreSQL e consultar via
 *   Prisma, eliminando a dependência do arquivo CSV em produção.
 */

import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  avaliarPendencias,
  calcularConfiancaCadastral,
  calcularPontuacaoOportunidade,
} from "../../common/cadastral-quality";
import { isValidCnpj } from "../../common/cnpj-validator";
import { normalizeCnpj } from "../../common/cnpj";
import { CnpjProvider, CnpjSearchPayload, ExternalCompany } from "./cnpj-provider.interface";

// ─── Mapeamento Cidade → Código TOM da Receita Federal ─────────────────────
const CITY_TOM_MAP: Record<string, string> = {
  tupa: "7201",
  marilia: "6681",
  pompeia: "6901",
  garca: "6475",
  bastos: "6215",
  assis: "6179",
  ourinhos: "6795",
  lins: "6643",
  bauru: "6219",
  "presidente prudente": "6929",
  aracatuba: "6155",
};

const TOM_CITY_MAP: Record<string, string> = {
  "7201": "Tupã",
  "6681": "Marília",
  "6901": "Pompeia",
  "6475": "Garça",
  "6215": "Bastos",
  "6179": "Assis",
  "6795": "Ourinhos",
  "6643": "Lins",
  "6219": "Bauru",
  "6929": "Presidente Prudente",
  "6155": "Araçatuba",
};

// ─── Centroides municipais (coordenada de referência — NÃO é endereço real) ─
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  "Tupã": { lat: -21.9347, lng: -50.5136 },
  "Marília": { lat: -22.2172, lng: -49.9501 },
  "Pompeia": { lat: -22.1070, lng: -50.1712 },
  "Garça": { lat: -22.2125, lng: -49.6546 },
  "Bastos": { lat: -21.9210, lng: -50.7358 },
  "Assis": { lat: -22.6612, lng: -50.4113 },
  "Ourinhos": { lat: -22.9787, lng: -49.8701 },
  "Lins": { lat: -21.6738, lng: -49.7487 },
  "Bauru": { lat: -22.3231, lng: -49.0738 },
  "Presidente Prudente": { lat: -22.1211, lng: -51.3881 },
  "Araçatuba": { lat: -21.2059, lng: -50.4389 },
};

// ─── CNAEs alvo do produto (usados para pontuação de oportunidade) ──────────
const TARGET_CNAES = ["4712100"];
const PRIORITY_CITIES = Object.values(TOM_CITY_MAP);

@Injectable()
export class ReceitaFederalProvider implements CnpjProvider, OnModuleDestroy {
  private readonly logger = new Logger(ReceitaFederalProvider.name);

  /**
   * Cache em memória indexado por código TOM.
   * Chave: código TOM (ex: "7201"). Valor: array de linhas CSV já parseadas.
   *
   * MVP: este cache mantém os dados em RAM para evitar releitura do CSV.
   * Evolução recomendada: importar os dados para o PostgreSQL e consultar via
   * Prisma, removendo a dependência do arquivo CSV em produção.
   */
  private readonly cache = new Map<string, string[][]>();
  private cacheLoaded = false;
  private cacheLoading: Promise<void> | null = null;

  private getCsvPath(): string {
    const candidates = [
      path.resolve(process.cwd(), "../dadosCNAE/sp_4712100_estabelecimentos.csv"),
      path.resolve(process.cwd(), "dadosCNAE/sp_4712100_estabelecimentos.csv"),
      path.resolve(__dirname, "../../../../dadosCNAE/sp_4712100_estabelecimentos.csv"),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        this.logger.log(`CSV da Receita Federal encontrado em: ${p}`);
        return p;
      }
    }

    throw new Error(
      "Arquivo sp_4712100_estabelecimentos.csv não encontrado. Verifique se existe em 'dadosCNAE/' na raiz do projeto.",
    );
  }

  /**
   * Carrega o CSV inteiro em memória indexado por código TOM.
   * Executado apenas uma vez (lazy). Thread-safe via promise compartilhada.
   */
  private async ensureCache(): Promise<void> {
    if (this.cacheLoaded) return;
    if (this.cacheLoading) return this.cacheLoading;

    this.cacheLoading = (async () => {
      this.logger.log("Iniciando carga do CSV da Receita Federal em memória...");
      const csvPath = this.getCsvPath();
      const fileStream = fs.createReadStream(csvPath);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let total = 0;
      for await (const line of rl) {
        if (!line.trim()) continue;
        const row = this.parseCsvLine(line);
        const tomCode = row[20];
        if (!tomCode) continue;

        if (!this.cache.has(tomCode)) this.cache.set(tomCode, []);
        this.cache.get(tomCode)!.push(row);
        total++;
      }

      this.cacheLoaded = true;
      this.logger.log(`Cache carregado: ${total} registros em ${this.cache.size} municípios.`);
    })();

    return this.cacheLoading;
  }

  onModuleDestroy() {
    this.cache.clear();
  }

  private parseCsvLine(line: string): string[] {
    return line.split(";").map((field) => field.replace(/^"|"$/g, "").trim());
  }

  /**
   * Gera jitter determinístico baseado no CNPJ usando hash simples.
   * O mesmo CNPJ sempre gera a mesma posição aproximada — evita que o ponto
   * mude a cada reload do sistema.
   *
   * Deslocamento máximo: ±0.014 graus (~1.5 km do centroide municipal).
   * Este deslocamento é APENAS VISUAL e não representa a localização real.
   */
  private deterministicJitter(cnpj: string): { dx: number; dy: number } {
    let hash = 0;
    for (let i = 0; i < cnpj.length; i++) {
      hash = (hash * 31 + cnpj.charCodeAt(i)) & 0xffffffff;
    }
    const dx = ((hash & 0xffff) / 0xffff - 0.5) * 0.028;
    const dy = (((hash >> 16) & 0xffff) / 0xffff - 0.5) * 0.028;
    return { dx, dy };
  }

  private getApproximateCoords(cityName: string, cnpj: string): { latitude: number | null; longitude: number | null } {
    const base = CITY_COORDS[cityName];
    if (!base) return { latitude: null, longitude: null };

    const { dx, dy } = this.deterministicJitter(cnpj);
    return {
      latitude: base.lat + dx,
      longitude: base.lng + dy,
    };
  }

  private mapRowToCompany(row: string[]): ExternalCompany {
    const cnpjRaw =
      (row[0] || "").padStart(8, "0") +
      (row[1] || "").padStart(4, "0") +
      (row[2] || "").padStart(2, "0");

    const matrizFilial = row[3] === "1" ? "MATRIZ" : row[3] === "2" ? "FILIAL" : null;
    const nomeFantasia = row[4]?.trim() || null;
    const razaoSocial = nomeFantasia || `EMPRESA CNPJ ${cnpjRaw}`;

    const situacaoMap: Record<string, string> = {
      "01": "NULA",
      "02": "ATIVA",
      "03": "SUSPENSA",
      "04": "INAPTA",
      "08": "BAIXADA",
    };
    const situacaoCadastral = situacaoMap[row[5]] ?? "DESCONHECIDA";

    let dataAbertura: Date | null = null;
    if (row[10] && row[10].length === 8) {
      const year = parseInt(row[10].slice(0, 4), 10);
      const month = parseInt(row[10].slice(4, 6), 10) - 1;
      const day = parseInt(row[10].slice(6, 8), 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        dataAbertura = new Date(year, month, day);
      }
    }

    const cnaePrincipal = row[11]?.replace(/\D/g, "") || null;
    const cnaesList: string[] = cnaePrincipal ? [cnaePrincipal] : [];
    if (row[12]) {
      row[12].split(",").forEach((c) => {
        const clean = c.replace(/\D/g, "");
        if (clean && !cnaesList.includes(clean)) cnaesList.push(clean);
      });
    }

    const logradouro = [row[13], row[14]].filter(Boolean).join(" ").trim() || null;
    const numero = row[15]?.trim() || null;
    const complemento = row[16]?.trim() || null;
    const bairro = row[17]?.trim() || null;
    const cep = row[18]?.replace(/\D/g, "") || null;
    const uf = row[19] || "SP";
    const cityCode = row[20];
    const cidade = TOM_CITY_MAP[cityCode] || `Municipio ${cityCode}`;

    // ─── Telefone: colunas 22 (DDD1) + 23 (FONE1) ──────────────────────────
    const ddd1 = row[21]?.trim();
    const fone1 = row[22]?.trim();
    const telefone = ddd1 && fone1 ? `(${ddd1}) ${fone1}` : fone1 || null;

    // ─── E-mail: coluna 28 ───────────────────────────────────────────────────
    const email = row[27]?.trim() || null;

    // ─── Coordenadas aproximadas (NÃO é endereço real) ──────────────────────
    const { latitude, longitude } = this.getApproximateCoords(cidade, cnpjRaw);
    const origemCoordenada = latitude !== null ? "municipio_centroide_jitter" : "sem_coordenada";

    // ─── Qualidade Cadastral ─────────────────────────────────────────────────
    const qualInput = {
      cnpj: cnpjRaw,
      situacaoCadastral,
      nomeFantasia,
      logradouro,
      numero,
      bairro,
      cep,
      telefone,
      email,
      cidade,
      cnaePrincipal,
      origemCoordenada,
      latitude,
      longitude,
    };

    const { score: confiancaVerificacao, statusVerificacaoEndereco } = calcularConfiancaCadastral(qualInput);
    const { score: pontuacaoOportunidade, nivelOportunidade, motivos: motivoPontuacao } =
      calcularPontuacaoOportunidade(qualInput, TARGET_CNAES, PRIORITY_CITIES, confiancaVerificacao);
    const { pendenteValidacao, motivosPendencia } = avaliarPendencias(qualInput);
    const enderecoCompleto = !!(logradouro && numero && bairro && cep);

    // Validar CNPJ com dígito verificador
    const cnpjValido = isValidCnpj(cnpjRaw);

    return {
      cnpj: cnpjRaw,
      razaoSocial,
      nomeFantasia,
      situacaoCadastral,
      porte: null,
      matrizFilial,
      dataAbertura,
      cnaePrincipal,
      cnaes: cnaesList,
      uf,
      cidade,
      bairro,
      cep,
      logradouro,
      numero,
      complemento,
      telefone,
      email,
      latitude,
      longitude,
      source: "receita-federal",
      origemCoordenada,
      statusVerificacaoEndereco,
      confiancaVerificacao,
      enderecoCompleto,
      pendenteValidacao: pendenteValidacao || !cnpjValido,
      motivosPendencia: [
        ...motivosPendencia,
        ...(!cnpjValido ? ["CNPJ com dígito verificador inválido"] : []),
      ],
      pontuacaoOportunidade,
      nivelOportunidade,
      motivoPontuacao,
    };
  }

  async searchCompaniesByCityAndCnae(payload: CnpjSearchPayload): Promise<ExternalCompany[]> {
    await this.ensureCache();

    const normalizedCity = payload.cityName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

    const targetTom = CITY_TOM_MAP[normalizedCity];
    if (!targetTom) {
      this.logger.warn(`Cidade não mapeada no sistema TOM: ${payload.cityName}`);
      return [];
    }

    const searchCnae = payload.cnaeCode.replace(/\D/g, "");
    const rows = this.cache.get(targetTom) ?? [];
    const results: ExternalCompany[] = [];

    for (const row of rows) {
      const rowCnae = (row[11] || "").replace(/\D/g, "");
      const secCnaes = (row[12] || "").split(",").map((c) => c.replace(/\D/g, "")).filter(Boolean);
      const isCnaeMatch = rowCnae === searchCnae || secCnaes.includes(searchCnae);

      if (isCnaeMatch) {
        results.push(this.mapRowToCompany(row));
        if (results.length >= payload.limit) break;
      }
    }

    this.logger.log(
      `Busca: cidade=${payload.cityName}, CNAE=${payload.cnaeCode} → ${results.length} resultado(s).`,
    );
    return results;
  }

  async getCompanyByCnpj(cnpj: string): Promise<ExternalCompany | null> {
    await this.ensureCache();

    const searchCnpj = normalizeCnpj(cnpj);

    for (const rows of this.cache.values()) {
      for (const row of rows) {
        const rowCnpj =
          (row[0] || "").padStart(8, "0") +
          (row[1] || "").padStart(4, "0") +
          (row[2] || "").padStart(2, "0");

        if (rowCnpj === searchCnpj) {
          return this.mapRowToCompany(row);
        }
      }
    }

    return null;
  }
}
