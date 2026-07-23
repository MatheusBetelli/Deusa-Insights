export const VALIDATION_STATUSES = [
  "confirmado",
  "provavel",
  "aguardando_validacao",
  "nao_encontrado",
  "endereco_invalido",
  "resultado_incompativel",
  "fechado",
  "revisao_manual",
  "rejeitado",
] as const;

export type ValidationStatus = (typeof VALIDATION_STATUSES)[number];

export const LOCATION_ORIGINS = [
  "validacao_manual_com_evidencia",
  "google_places",
  "google_maps",
  "site_oficial",
  "rede_social_oficial",
  "validacao_em_campo",
  "outro_diretorio_comercial",
  "coordenada_manual",
  "sem_coordenada",
  "geocodificacao_endereco",
  "municipio_centroide",
  "municipio_centroide_jitter",
] as const;

export type LocationOrigin = (typeof LOCATION_ORIGINS)[number];

export const OPPORTUNITY_LEVELS = ["alta", "media", "baixa"] as const;

export type OpportunityLevel = (typeof OPPORTUNITY_LEVELS)[number];

export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  confirmado: "✅ CONFIRMADO (Comércio Identificado & Comprovado)",
  provavel: "⚠️ PROVÁVEL (Existe Comércio no Endereço, CNPJ a Confirmar)",
  aguardando_validacao: "⏳ Aguardando Validação",
  nao_encontrado: "❓ NÃO ENCONTRADO (Nenhum Comércio no Local)",
  endereco_invalido: "❌ ENDEREÇO INVÁLIDO",
  resultado_incompativel: "🚫 RESULTADO INCOMPATÍVEL (Residência/Terreno/Outro Ramo)",
  fechado: "🔒 FECHADO DEFINITIVAMENTE",
  revisao_manual: "🔍 REVISÃO MANUAL NECESSÁRIA",
  rejeitado: "🛑 REJEITADO",
};

export const LOCATION_ORIGIN_LABELS: Record<string, string> = {
  validacao_manual_com_evidencia: "📍 Validação Manual com Evidência (Link Google Maps)",
  google_maps: "Google Maps / Busca Digital",
  google_places: "Google Places (API / Place ID)",
  site_oficial: "Site Oficial do Comércio",
  rede_social_oficial: "Rede Social Oficial (Instagram/Facebook)",
  validacao_em_campo: "📍 Validação em Campo (Visita Presencial)",
  outro_diretorio_comercial: "Outro Diretório Comercial",
  coordenada_manual: "❌ Coordenada Manual Sem Evidência (Apenas Provável)",
};

export const OPPORTUNITY_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  alta: { bg: "#0F58A0", border: "#60A5FA", label: "Alta Oportunidade" },
  media: { bg: "#D97706", border: "#FCD34D", label: "Média Oportunidade" },
  baixa: { bg: "#64748B", border: "#94A3B8", label: "Baixa Oportunidade" },
};
