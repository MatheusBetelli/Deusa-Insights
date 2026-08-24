/**
 * Serviço de qualidade cadastral para dados da Receita Federal.
 *
 * Calcula três dimensões independentes para cada empresa:
 *  1. Confiança Cadastral (0–100): qualidade dos dados cadastrais
 *  2. Pontuação de Oportunidade (0–100): potencial comercial
 *  3. Pendências: lista de problemas que requerem validação manual
 *
 * IMPORTANTE: "confiavel_cadastralmente" NÃO significa endereço verificado
 * no Google Maps. Significa apenas que os dados cadastrais estão completos
 * o suficiente para análise inicial.
 */

export type QualidadeInput = {
  cnpj: string;
  situacaoCadastral?: string | null;
  nomeFantasia?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  cidade?: string | null;
  cnaePrincipal?: string | null;
  origemCoordenada?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type ConfiancaResult = {
  score: number;
  statusVerificacaoEndereco: string;
};

export type OportunidadeResult = {
  score: number;
  nivelOportunidade: string;
  motivos: string[];
};

export type PendenciaResult = {
  pendenteValidacao: boolean;
  motivosPendencia: string[];
};

function normalize(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

function isEnderecoCompleto(input: QualidadeInput): boolean {
  return !!(input.logradouro?.trim() && input.numero?.trim() && input.bairro?.trim() && input.cep?.trim());
}

function isCoordenadaAproximada(origemCoordenada?: string | null): boolean {
  if (!origemCoordenada) return false;
  return origemCoordenada.includes("centroide") || origemCoordenada.includes("jitter");
}

/**
 * Calcula a confiança cadastral de 0 a 100.
 *
 * ATENÇÃO: A classificação "confiavel_cadastralmente" significa apenas que os
 * dados cadastrais estão completos para análise inicial. NÃO significa que o
 * endereço foi validado fisicamente ou via API de geocodificação.
 */
export function calcularConfiancaCadastral(input: QualidadeInput): ConfiancaResult {
  let score = 0;

  // CNPJ com 14 dígitos numéricos: +15
  if (input.cnpj.replace(/\D/g, "").length === 14) score += 15;

  // Situação cadastral ATIVA: +25
  if (normalize(input.situacaoCadastral) === "ATIVA") score += 25;

  // Nome fantasia preenchido: +10
  if (input.nomeFantasia?.trim()) score += 10;

  // Endereço completo (logradouro + número + bairro + CEP): +20
  if (isEnderecoCompleto(input)) score += 20;

  // CEP preenchido: +10
  if (input.cep?.trim()) score += 10;

  // Telefone preenchido: +10
  if (input.telefone?.trim()) score += 10;

  // E-mail preenchido: +5
  if (input.email?.trim()) score += 5;

  // Município mapeado (cidade conhecida, não "Municipio XXXX"): +5
  if (input.cidade && !input.cidade.startsWith("Municipio ")) score += 5;

  score = Math.max(0, Math.min(100, score));

  let statusVerificacaoEndereco: string;
  if (score >= 80) {
    statusVerificacaoEndereco = "confiavel_cadastralmente";
  } else if (score >= 50) {
    statusVerificacaoEndereco = "aproximado";
  } else {
    statusVerificacaoEndereco = "nao_verificado";
  }

  // Coordenada apenas aproximada não eleva status para confiavel_cadastralmente
  if (isCoordenadaAproximada(input.origemCoordenada) && statusVerificacaoEndereco === "confiavel_cadastralmente") {
    statusVerificacaoEndereco = "aproximado";
  }

  return { score, statusVerificacaoEndereco };
}

type OpportunityCriterion = {
  matches: boolean;
  points: number;
  metMessage: string;
  unmetMessage: string;
};

function evaluateOpportunityCriteria(criteria: OpportunityCriterion[]): {
  score: number;
  motivos: string[];
} {
  let score = 0;
  const motivos: string[] = [];

  for (const criterion of criteria) {
    if (criterion.matches) score += criterion.points;
    motivos.push(criterion.matches ? criterion.metMessage : criterion.unmetMessage);
  }

  return { score, motivos };
}

function getOpportunityLevel(score: number): string {
  if (score >= 80) return "alta";
  if (score >= 50) return "media";
  return "baixa";
}

/**
 * Calcula a pontuação comercial de oportunidade de 0 a 100.
 * Separada da confiança cadastral — mede potencial de negócio.
 */
export function calcularPontuacaoOportunidade(
  input: QualidadeInput,
  targetCnaes: string[],
  priorityCities: string[],
  confiancaScore: number,
): OportunidadeResult {
  const cnae = (input.cnaePrincipal ?? "").replace(/\D/g, "");
  const targetSet = new Set(targetCnaes.map((c) => c.replace(/\D/g, "")));
  const cityNorm = normalize(input.cidade);
  const priorityNorms = priorityCities.map(normalize);
  const { score: rawScore, motivos } = evaluateOpportunityCriteria([
    {
      matches: Boolean(cnae && targetSet.has(cnae)),
      points: 30,
      metMessage: `CNAE ${cnae} alvo (+30)`,
      unmetMessage: `CNAE ${cnae || "não informado"} não é alvo (+0)`,
    },
    {
      matches: normalize(input.situacaoCadastral) === "ATIVA",
      points: 25,
      metMessage: "Situação cadastral ATIVA (+25)",
      unmetMessage: `Situação ${input.situacaoCadastral ?? "desconhecida"} — não ativa (+0)`,
    },
    {
      matches: isEnderecoCompleto(input),
      points: 15,
      metMessage: "Endereço completo (+15)",
      unmetMessage: "Endereço incompleto (+0)",
    },
    {
      matches: Boolean(input.telefone?.trim()),
      points: 10,
      metMessage: "Telefone preenchido (+10)",
      unmetMessage: "Telefone ausente (+0)",
    },
    {
      matches: Boolean(input.email?.trim()),
      points: 5,
      metMessage: "E-mail preenchido (+5)",
      unmetMessage: "E-mail ausente (+0)",
    },
    {
      matches: Boolean(cityNorm && priorityNorms.includes(cityNorm)),
      points: 10,
      metMessage: `Município ${input.cidade} monitorado (+10)`,
      unmetMessage: `Município ${input.cidade ?? "desconhecido"} não monitorado (+0)`,
    },
    {
      matches: confiancaScore >= 70,
      points: 5,
      metMessage: `Confiança cadastral ${confiancaScore}/100 (>70) (+5)`,
      unmetMessage: `Confiança cadastral ${confiancaScore}/100 (≤70) (+0)`,
    },
  ]);
  const score = Math.max(0, Math.min(100, rawScore));
  const nivelOportunidade = getOpportunityLevel(score);

  return { score, nivelOportunidade, motivos };
}

/**
 * Avalia pendências cadastrais que requerem validação manual antes da abordagem comercial.
 */
export function avaliarPendencias(input: QualidadeInput): PendenciaResult {
  const motivosPendencia: string[] = [];

  if (!input.nomeFantasia?.trim()) {
    motivosPendencia.push("Nome fantasia não informado");
  }

  if (!input.logradouro?.trim()) {
    motivosPendencia.push("Logradouro não informado");
  }

  if (!input.numero?.trim()) {
    motivosPendencia.push("Número do endereço não informado");
  }

  if (!input.bairro?.trim()) {
    motivosPendencia.push("Bairro não informado");
  }

  if (!input.cep?.trim()) {
    motivosPendencia.push("CEP não informado");
  }

  if (!input.telefone?.trim()) {
    motivosPendencia.push("Telefone não informado");
  }

  if (normalize(input.situacaoCadastral) !== "ATIVA") {
    motivosPendencia.push(`Situação cadastral: ${input.situacaoCadastral ?? "desconhecida"} (não ativa)`);
  }

  if (!input.cidade || input.cidade.startsWith("Municipio ")) {
    motivosPendencia.push("Município não mapeado no sistema");
  }

  if (!input.latitude || !input.longitude) {
    motivosPendencia.push("Coordenadas geográficas ausentes");
  } else if (isCoordenadaAproximada(input.origemCoordenada)) {
    motivosPendencia.push("Localização aproximada por centroide municipal (não é o endereço exato)");
  }

  return {
    pendenteValidacao: motivosPendencia.length > 0,
    motivosPendencia,
  };
}
