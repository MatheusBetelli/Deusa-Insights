/**
 * Script de Relatório de Qualidade da Base — Receita Federal
 *
 * Lê o CSV completo sem importar para o banco, analisa todos os registros
 * e gera dois arquivos:
 *   1. dadosCNAE/analysis_quality_report.md  — relatório com estatísticas
 *   2. dadosCNAE/leads_para_validacao_manual.csv — leads prioritários para validação
 *
 * Uso:
 *   npm run quality:report
 *   (ou: npx ts-node scripts/generate-quality-report.ts)
 */

import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import {
  avaliarPendencias,
  calcularConfiancaCadastral,
  calcularPontuacaoOportunidade,
} from "../src/common/cadastral-quality";
import { isValidCnpj } from "../src/common/cnpj-validator";

// ─── Configuração ────────────────────────────────────────────────────────────

const CSV_CANDIDATES = [
  path.resolve(__dirname, "../../dadosCNAE/sp_4712100_estabelecimentos.csv"),
  path.resolve(__dirname, "../dadosCNAE/sp_4712100_estabelecimentos.csv"),
  path.resolve(process.cwd(), "../dadosCNAE/sp_4712100_estabelecimentos.csv"),
  path.resolve(process.cwd(), "dadosCNAE/sp_4712100_estabelecimentos.csv"),
];

const REPORT_DIR_CANDIDATES = [
  path.resolve(__dirname, "../../dadosCNAE"),
  path.resolve(process.cwd(), "../dadosCNAE"),
  path.resolve(process.cwd(), "dadosCNAE"),
];

const TOM_CITY_MAP: Record<string, string> = {
  "7201": "Tupã", "6681": "Marília", "6901": "Pompeia", "6475": "Garça",
  "6215": "Bastos", "6179": "Assis", "6795": "Ourinhos", "6643": "Lins",
  "6219": "Bauru", "6929": "Presidente Prudente", "6155": "Araçatuba",
};

const CITY_NAMES = new Set(Object.values(TOM_CITY_MAP));
const TARGET_CNAES = ["4712100"];
const PRIORITY_CITIES = Object.values(TOM_CITY_MAP);

const SITUACAO_MAP: Record<string, string> = {
  "01": "NULA", "02": "ATIVA", "03": "SUSPENSA", "04": "INAPTA", "08": "BAIXADA",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

type ProcessedRecord = {
  cnpj: string;
  cnpjFormatado: string;
  nomeFantasia: string | null;
  situacaoCadastral: string;
  logradouro: string | null;
  numero: string | null;
  bairro: string | null;
  cep: string | null;
  municipioCodigo: string;
  municipioNome: string;
  telefone: string | null;
  email: string | null;
  enderecoCompleto: boolean;
  municipioMapeado: boolean;
  cnpjValido: boolean;
  confiancaVerificacao: number;
  statusVerificacaoEndereco: string;
  pontuacaoOportunidade: number;
  nivelOportunidade: string;
  pendenteValidacao: boolean;
  motivosPendencia: string[];
  origemCoordenada: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  return line.split(";").map((f) => f.replace(/^"|"$/g, "").trim());
}

function formatCnpj(cnpj: string): string {
  return `${cnpj.slice(0, 2)}.${cnpj.slice(2, 5)}.${cnpj.slice(5, 8)}/${cnpj.slice(8, 12)}-${cnpj.slice(12, 14)}`;
}

function findCsv(): string {
  for (const p of CSV_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`CSV não encontrado. Tentados: ${CSV_CANDIDATES.join(", ")}`);
}

function findReportDir(): string {
  for (const p of REPORT_DIR_CANDIDATES) {
    if (fs.existsSync(p)) return p;
  }
  const fallback = REPORT_DIR_CANDIDATES[REPORT_DIR_CANDIDATES.length - 1];
  fs.mkdirSync(fallback, { recursive: true });
  return fallback;
}

// ─── Processamento ────────────────────────────────────────────────────────────

async function processRecords(): Promise<{
  records: ProcessedRecord[];
  totalLidos: number;
  cnpjsDuplicados: number;
}> {
  const csvPath = findCsv();
  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  const seenCnpjs = new Set<string>();
  const records: ProcessedRecord[] = [];
  let totalLidos = 0;
  let cnpjsDuplicados = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    totalLidos++;

    const row = parseLine(line);
    const cnpj = (row[0] || "").padStart(8, "0") + (row[1] || "").padStart(4, "0") + (row[2] || "").padStart(2, "0");

    if (seenCnpjs.has(cnpj)) {
      cnpjsDuplicados++;
      continue;
    }
    seenCnpjs.add(cnpj);

    const situacaoCadastral = SITUACAO_MAP[row[5]] ?? "DESCONHECIDA";
    const nomeFantasia = row[4]?.trim() || null;
    const logradouro = [row[13], row[14]].filter(Boolean).join(" ").trim() || null;
    const numero = row[15]?.trim() || null;
    const bairro = row[17]?.trim() || null;
    const cep = row[18]?.replace(/\D/g, "") || null;
    const municipioCodigo = row[20] || "";
    const municipioNome = TOM_CITY_MAP[municipioCodigo] || `Municipio ${municipioCodigo}`;
    const municipioMapeado = CITY_NAMES.has(municipioNome);
    const ddd1 = row[21]?.trim();
    const fone1 = row[22]?.trim();
    const telefone = ddd1 && fone1 ? `(${ddd1}) ${fone1}` : fone1 || null;
    const email = row[27]?.trim() || null;
    const cnaePrincipal = row[11]?.replace(/\D/g, "") || null;
    const enderecoCompleto = !!(logradouro && numero && bairro && cep);
    const origemCoordenada = municipioMapeado ? "municipio_centroide_jitter" : "sem_coordenada";
    const cnpjValido = isValidCnpj(cnpj);

    const qualInput = {
      cnpj, situacaoCadastral, nomeFantasia, logradouro, numero, bairro, cep,
      telefone, email, cidade: municipioNome, cnaePrincipal, origemCoordenada,
      latitude: municipioMapeado ? -22.0 : null,
      longitude: municipioMapeado ? -50.0 : null,
    };

    const { score: confianca, statusVerificacaoEndereco } = calcularConfiancaCadastral(qualInput);
    const { score: pontuacao, nivelOportunidade, motivos: motivoPontuacao } =
      calcularPontuacaoOportunidade(qualInput, TARGET_CNAES, PRIORITY_CITIES, confianca);
    const { pendenteValidacao, motivosPendencia } = avaliarPendencias(qualInput);

    records.push({
      cnpj, cnpjFormatado: formatCnpj(cnpj), nomeFantasia, situacaoCadastral,
      logradouro, numero, bairro, cep, municipioCodigo, municipioNome,
      telefone, email, enderecoCompleto, municipioMapeado, cnpjValido,
      confiancaVerificacao: confianca, statusVerificacaoEndereco,
      pontuacaoOportunidade: pontuacao, nivelOportunidade,
      pendenteValidacao, motivosPendencia: [...motivosPendencia, ...(!cnpjValido ? ["CNPJ com dígito verificador inválido"] : [])],
      origemCoordenada,
    });
  }

  return { records, totalLidos, cnpjsDuplicados };
}

// ─── Geração do Relatório Markdown ────────────────────────────────────────────

function generateReport(records: ProcessedRecord[], totalLidos: number, cnpjsDuplicados: number): string {
  const totalImportados = records.length;

  const bySituacao = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.situacaoCadastral] = (acc[r.situacaoCadastral] || 0) + 1;
    return acc;
  }, {});

  const semNomeFantasia = records.filter((r) => !r.nomeFantasia).length;
  const semEnderecoCompleto = records.filter((r) => !r.enderecoCompleto).length;
  const semTelefone = records.filter((r) => !r.telefone).length;
  const semEmail = records.filter((r) => !r.email).length;
  const comMunicipioMapeado = records.filter((r) => r.municipioMapeado).length;
  const comCoordenadaAproximada = records.filter((r) => r.origemCoordenada === "municipio_centroide_jitter").length;
  const semCoordenada = records.filter((r) => r.origemCoordenada === "sem_coordenada").length;
  const totalPendente = records.filter((r) => r.pendenteValidacao).length;
  const cnpjsInvalidos = records.filter((r) => !r.cnpjValido).length;

  const byOportunidade = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.nivelOportunidade] = (acc[r.nivelOportunidade] || 0) + 1;
    return acc;
  }, {});

  const byStatus = records.reduce<Record<string, number>>((acc, r) => {
    acc[r.statusVerificacaoEndereco] = (acc[r.statusVerificacaoEndereco] || 0) + 1;
    return acc;
  }, {});

  // Top 20 municípios com mais ativos
  const municipioCount = records
    .filter((r) => r.situacaoCadastral === "ATIVA")
    .reduce<Record<string, number>>((acc, r) => {
      acc[r.municipioNome] = (acc[r.municipioNome] || 0) + 1;
      return acc;
    }, {});

  const top20 = Object.entries(municipioCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 20);

  const now = new Date().toISOString().split("T")[0];

  return `# Relatório de Qualidade da Base — Receita Federal
**Gerado em:** ${now}
**Fonte:** CSV ESTABELE — CNAE 4712100 (Minimercados, Mercearias e Armazéns) — Estado de SP

---

## 1. Totais Gerais

| Métrica | Valor |
|---|---|
| Total de registros lidos | ${totalLidos.toLocaleString("pt-BR")} |
| Total de registros processados (únicos) | ${totalImportados.toLocaleString("pt-BR")} |
| CNPJs duplicados ignorados | ${cnpjsDuplicados.toLocaleString("pt-BR")} |
| CNPJs com dígito verificador inválido | ${cnpjsInvalidos.toLocaleString("pt-BR")} |

## 2. Por Situação Cadastral

| Situação | Quantidade |
|---|---|
| ATIVA | ${(bySituacao["ATIVA"] || 0).toLocaleString("pt-BR")} |
| BAIXADA | ${(bySituacao["BAIXADA"] || 0).toLocaleString("pt-BR")} |
| INAPTA | ${(bySituacao["INAPTA"] || 0).toLocaleString("pt-BR")} |
| SUSPENSA | ${(bySituacao["SUSPENSA"] || 0).toLocaleString("pt-BR")} |
| NULA | ${(bySituacao["NULA"] || 0).toLocaleString("pt-BR")} |
| DESCONHECIDA | ${(bySituacao["DESCONHECIDA"] || 0).toLocaleString("pt-BR")} |

## 3. Completude dos Dados

| Campo | Sem preenchimento |
|---|---|
| Nome fantasia | ${semNomeFantasia.toLocaleString("pt-BR")} |
| Endereço completo | ${semEnderecoCompleto.toLocaleString("pt-BR")} |
| Telefone | ${semTelefone.toLocaleString("pt-BR")} |
| E-mail | ${semEmail.toLocaleString("pt-BR")} |

## 4. Mapeamento Municipal e Coordenadas

| Métrica | Valor |
|---|---|
| Com município mapeado no sistema | ${comMunicipioMapeado.toLocaleString("pt-BR")} |
| Com coordenada aproximada (centroide + jitter) | ${comCoordenadaAproximada.toLocaleString("pt-BR")} |
| Sem coordenada (município não mapeado) | ${semCoordenada.toLocaleString("pt-BR")} |
| Pendentes de validação manual | ${totalPendente.toLocaleString("pt-BR")} |

## 5. Por Nível de Oportunidade Comercial

| Nível | Quantidade |
|---|---|
| Alta (80–100 pts) | ${(byOportunidade["alta"] || 0).toLocaleString("pt-BR")} |
| Média (50–79 pts) | ${(byOportunidade["media"] || 0).toLocaleString("pt-BR")} |
| Baixa (0–49 pts) | ${(byOportunidade["baixa"] || 0).toLocaleString("pt-BR")} |

## 6. Por Status de Verificação de Endereço

| Status | Quantidade |
|---|---|
| confiavel_cadastralmente | ${(byStatus["confiavel_cadastralmente"] || 0).toLocaleString("pt-BR")} |
| aproximado | ${(byStatus["aproximado"] || 0).toLocaleString("pt-BR")} |
| nao_verificado | ${(byStatus["nao_verificado"] || 0).toLocaleString("pt-BR")} |
| verificado | ${(byStatus["verificado"] || 0).toLocaleString("pt-BR")} |
| divergente | ${(byStatus["divergente"] || 0).toLocaleString("pt-BR")} |
| nao_encontrado | ${(byStatus["nao_encontrado"] || 0).toLocaleString("pt-BR")} |

## 7. Top 20 Municípios com Mais Estabelecimentos Ativos

| # | Município | Ativos |
|---|---|---|
${top20.map(([municipio, count], i) => `| ${i + 1} | ${municipio} | ${count.toLocaleString("pt-BR")} |`).join("\n")}

---

## 8. Como o Mapa Está Sendo Alimentado

O mapa de oportunidades é alimentado com **coordenadas aproximadas por município**, geradas da seguinte forma:

1. Para cada estabelecimento importado, o sistema localiza o centroide geográfico do município (latitude e longitude central da cidade, obtidas de fonte pública).
2. É aplicado um **jitter determinístico baseado no CNPJ**: um pequeno deslocamento fixo (±0,014 graus, ~1,5 km) derivado de um hash do CNPJ. Isso garante que pontos de diferentes estabelecimentos não se sobreponham exatamente e que o mesmo estabelecimento aparece sempre na mesma posição aproximada entre sessões.

**Resultado visual:** Os pontos no mapa se distribuem em uma nuvem ao redor do centro da cidade, criando uma visualização de densidade por município.

## 9. Limitação Atual

> ⚠️ **As coordenadas exibidas no mapa NÃO representam o endereço físico exato de nenhum estabelecimento.**
>
> A base da Receita Federal (layout ESTABELE) não contém campos de latitude e longitude dos estabelecimentos.
> O campo \`origemCoordenada = "municipio_centroide_jitter"\` identifica esses pontos aproximados.
> O campo \`statusVerificacaoEndereco = "aproximado"\` reflete essa limitação.
>
> Para obter coordenadas reais, será necessário uma etapa futura de geocodificação via Google Maps API
> ou similar, configurando a variável de ambiente \`GOOGLE_MAPS_API_KEY\` no backend.

---
*Relatório gerado automaticamente pelo script \`npm run quality:report\`.*
`;
}

// ─── Geração do CSV de Validação Manual ──────────────────────────────────────

function generateValidationCsv(records: ProcessedRecord[]): string {
  const qualifying = records.filter(
    (r) =>
      r.situacaoCadastral === "ATIVA" &&
      (r.nivelOportunidade === "alta" || r.nivelOportunidade === "media") &&
      (r.logradouro || r.bairro) &&
      (r.telefone || r.email) &&
      r.statusVerificacaoEndereco !== "verificado",
  );

  const header = [
    "cnpj", "cnpj_formatado", "nome_fantasia", "situacao_cadastral_label",
    "endereco_completo", "bairro", "municipio_codigo", "municipio_nome",
    "telefone", "email", "pontuacao_oportunidade", "nivel_oportunidade",
    "confianca_verificacao", "status_verificacao_endereco", "origem_coordenada",
    "observacao_manual",
  ].join(";");

  const rows = qualifying.map((r) => {
    const endereco = [r.logradouro, r.numero, r.bairro, r.cep].filter(Boolean).join(", ");
    return [
      r.cnpj, r.cnpjFormatado, r.nomeFantasia ?? "", r.situacaoCadastral,
      endereco, r.bairro ?? "", r.municipioCodigo, r.municipioNome,
      r.telefone ?? "", r.email ?? "",
      r.pontuacaoOportunidade, r.nivelOportunidade,
      r.confiancaVerificacao, r.statusVerificacaoEndereco, r.origemCoordenada,
      "", // observacao_manual — preenchido pela equipe
    ].join(";");
  });

  return [header, ...rows].join("\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🔍 Iniciando análise da base da Receita Federal...\n");

  const { records, totalLidos, cnpjsDuplicados } = await processRecords();
  console.log(`✓ ${totalLidos.toLocaleString("pt-BR")} registros lidos`);
  console.log(`✓ ${records.length.toLocaleString("pt-BR")} CNPJs únicos processados`);

  const reportDir = findReportDir();

  // Relatório de qualidade
  const reportPath = path.join(reportDir, "analysis_quality_report.md");
  const report = generateReport(records, totalLidos, cnpjsDuplicados);
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`✓ Relatório de qualidade gerado: ${reportPath}`);

  // CSV de validação manual
  const csvPath = path.join(reportDir, "leads_para_validacao_manual.csv");
  const csv = generateValidationCsv(records);
  const validationCount = csv.split("\n").length - 1; // descontar header
  fs.writeFileSync(csvPath, csv, "utf-8");
  console.log(`✓ CSV de validação manual gerado: ${csvPath}`);
  console.log(`  → ${validationCount.toLocaleString("pt-BR")} leads prioritários para validação`);

  // Sumário no console
  const ativos = records.filter((r) => r.situacaoCadastral === "ATIVA").length;
  const alta = records.filter((r) => r.nivelOportunidade === "alta").length;
  const pendentes = records.filter((r) => r.pendenteValidacao).length;
  console.log("\n📊 Sumário:");
  console.log(`  Ativos:            ${ativos.toLocaleString("pt-BR")}`);
  console.log(`  Alta oportunidade: ${alta.toLocaleString("pt-BR")}`);
  console.log(`  Pendentes:         ${pendentes.toLocaleString("pt-BR")}`);
  console.log("\n✅ Concluído.");
}

main().catch((err) => {
  console.error("❌ Erro:", err);
  process.exit(1);
});
