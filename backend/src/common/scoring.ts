import { PotentialLevel } from "@prisma/client";

// Sede da Distribuidora Deusa em Garça/SP
export const GARCA_COORDS = { lat: -22.2131, lon: -49.6553 };

// Distâncias rodoviárias estimadas de Garça/SP para municípios da região
const CITY_DISTANCES_GARCA: Record<string, number> = {
  garca: 0,
  gália: 15,
  galia: 15,
  veracruz: 18,
  "vera cruz": 18,
  marília: 25,
  marilia: 25,
  oriente: 40,
  pompéia: 50,
  pompeia: 50,
  quintana: 65,
  herculândia: 75,
  herculandia: 75,
  tupã: 85,
  tupa: 85,
  iacri: 98,
  rinópolis: 105,
  rinopolis: 105,
  bastos: 110,
  parapuã: 115,
  parapua: 115,
  "osvaldo cruz": 125,
  lucélia: 138,
  lucelia: 138,
  adamantina: 145,
  dracena: 190,
  bauru: 75,
  lins: 70,
  assis: 85,
  ourinhos: 90,
  "presidente prudente": 165,
  "ribeirão preto": 220,
  "ribeirao preto": 220,
  franca: 270,
  "são paulo": 420,
  "sao paulo": 420,
};

export type ScoreInput = {
  cnpj?: string | null;
  situacaoCadastral?: string | null;
  cnaePrincipal?: string | null;
  targetCnaes?: string[];
  nomeFantasia?: string | null;
  porte?: string | null;
  cidade?: string | null;
  uf?: string | null;
  priorityCities?: string[];
  latitude?: number | null;
  longitude?: number | null;
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  cep?: string | null;
  telefone?: string | null;
  statusLead?: string | null;
};

export type ScoreBreakdown = {
  perfilPts: number;     // max 30
  potencialPts: number;  // max 25
  logisticaPts: number;  // max 20
  dadosPts: number;      // max 10
  prontidaoPts: number;  // max 10
  territorioPts: number; // max 5
  distanceKm: number;
};

export type FullScoreResult = {
  score: number;
  level: PotentialLevel;
  breakdown: ScoreBreakdown;
};

function normalize(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Calcula a distância em km até a sede da Deusa em Garça/SP
 */
export function calculateGarcaDistance(lat?: number | null, lon?: number | null, city?: string | null): number {
  if (typeof lat === "number" && typeof lon === "number" && lat !== 0 && lon !== 0) {
    const R = 6371; // Raio da Terra em km
    const dLat = ((lat - GARCA_COORDS.lat) * Math.PI) / 180;
    const dLon = ((lon - GARCA_COORDS.lon) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((GARCA_COORDS.lat * Math.PI) / 180) *
        Math.cos((lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const directKm = R * c;
    // Fator de correção rodoviário (~1.25)
    return Math.round(directKm * 1.25);
  }

  const cityNorm = normalize(city);
  if (cityNorm && CITY_DISTANCES_GARCA[cityNorm] !== undefined) {
    return CITY_DISTANCES_GARCA[cityNorm];
  }

  return 120; // Fallback padrão para interior de SP não listado
}

/**
 * Calcula o Score de Oportunidade (0 a 100) com os 6 pilares ponderados:
 * 1. Perfil / CNAE (30%)
 * 2. Potencial comercial (25%)
 * 3. Proximidade logística de Garça/SP (20%)
 * 4. Qualidade cadastral dos dados (10%)
 * 5. Prontidão comercial (10%)
 * 6. Atratividade territorial (5%)
 */
export function calculateOpportunityScoreDetails(input: ScoreInput): FullScoreResult {
  const cnae = (input.cnaePrincipal ?? "").replace(/\D/g, "");
  const status = normalize(input.situacaoCadastral);
  const porte = normalize(input.porte);
  const city = normalize(input.cidade);

  // 1. Perfil / CNAE (Peso 30% -> max 30 pts)
  // Minimercados (4712100) e Supermercados (4711302) = 100 pts (* 0.30 = 30 pts)
  // Açougue (4722901), Hortifruti (4724500) = 70 pts (* 0.30 = 21 pts)
  let perfilScore = 20;
  if (cnae === "4712100" || cnae === "4711302" || cnae === "4711301") {
    perfilScore = 100;
  } else if (cnae === "4722901" || cnae === "4724500" || cnae === "4721100" || (input.targetCnaes && input.targetCnaes.some(tc => tc.replace(/\D/g, "") === cnae))) {
    perfilScore = 70;
  }
  const perfilPts = Math.round((perfilScore / 100) * 30);

  // 2. Potencial comercial (Peso 25% -> max 25 pts)
  let potencialScore = 40;
  if (porte === "epp") {
    potencialScore = 100;
  } else if (porte === "me") {
    potencialScore = 80;
  } else if (input.nomeFantasia && input.nomeFantasia.trim().length > 3) {
    potencialScore = 60;
  }
  const potencialPts = Math.round((potencialScore / 100) * 25);

  // 3. Proximidade Logística de Garça/SP (Peso 20% -> max 20 pts)
  const distanceKm = calculateGarcaDistance(input.latitude, input.longitude, input.cidade);
  let logisticaScore = 10;
  if (distanceKm <= 30) logisticaScore = 100;
  else if (distanceKm <= 60) logisticaScore = 85;
  else if (distanceKm <= 100) logisticaScore = 70;
  else if (distanceKm <= 150) logisticaScore = 50;
  else if (distanceKm <= 200) logisticaScore = 30;
  else logisticaScore = 10;
  const logisticaPts = Math.round((logisticaScore / 100) * 20);

  // 4. Qualidade cadastral (Peso 10% -> max 10 pts)
  let dadosRaw = 0;
  if (input.cnpj && input.cnpj.replace(/\D/g, "").length === 14) dadosRaw += 25;
  if (input.logradouro && input.numero && input.bairro && input.cep) dadosRaw += 30;
  if (input.telefone && input.telefone.trim().length >= 8) dadosRaw += 20;
  if (typeof input.latitude === "number" && typeof input.longitude === "number") dadosRaw += 25;
  const dadosPts = Math.round((Math.min(100, dadosRaw) / 100) * 10);

  // 5. Prontidão comercial (Peso 10% -> max 10 pts)
  let prontidaoScore = 0;
  if (status === "ativa" || status === "ativo") prontidaoScore += 50;
  if (!input.statusLead || (input.statusLead !== "CONVERTED" && input.statusLead !== "INACTIVE" && input.statusLead !== "NOT_INTERESTED")) {
    prontidaoScore += 50;
  }
  const prontidaoPts = Math.round((prontidaoScore / 100) * 10);

  // 6. Atratividade territorial (Peso 5% -> max 5 pts)
  const priorityCitiesSet = new Set([
    "bastos", "tupa", "tupã", "marilia", "marília", "garca", "garça", "galia", "gália",
    "oriente", "pompeia", "pompéia", "presidente prudente", "bauru", "assis", "ourinhos", "lins"
  ]);
  let territorioScore = priorityCitiesSet.has(city) ? 100 : 40;
  const territorioPts = Math.round((territorioScore / 100) * 5);

  const totalScore = Math.max(0, Math.min(100, perfilPts + potencialPts + logisticaPts + dadosPts + prontidaoPts + territorioPts));
  const level = getPotentialLevel(totalScore);

  return {
    score: totalScore,
    level,
    breakdown: {
      perfilPts,
      potencialPts,
      logisticaPts,
      dadosPts,
      prontidaoPts,
      territorioPts,
      distanceKm,
    },
  };
}

export function calculateLeadScore(input: ScoreInput): number {
  return calculateOpportunityScoreDetails(input).score;
}

export function getPotentialLevel(score: number): PotentialLevel {
  if (score >= 80) return PotentialLevel.CRITICAL;
  if (score >= 65) return PotentialLevel.HIGH;
  if (score >= 45) return PotentialLevel.MEDIUM;
  return PotentialLevel.LOW;
}
