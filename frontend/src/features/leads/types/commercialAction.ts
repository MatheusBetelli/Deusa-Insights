export const COMMERCIAL_ACTION_TYPES = [
  "VISITA",
  "LIGACAO",
  "WHATSAPP",
  "ENVIO",
  "RETORNO",
  "SEM_INTERESSE",
  "OUTRO",
] as const;

export type CommercialActionType = (typeof COMMERCIAL_ACTION_TYPES)[number];

export const HISTORICAL_COMMERCIAL_ACTION_TYPES = ["EMAIL", "REUNIAO"] as const;

export const COMMERCIAL_ACTION_LABELS: Record<string, string> = {
  VISITA: "Visita",
  LIGACAO: "Ligação",
  WHATSAPP: "WhatsApp",
  ENVIO: "Envio",
  EMAIL: "E-mail",
  REUNIAO: "Reunião",
  RETORNO: "Retorno",
  SEM_INTERESSE: "Sem interesse",
  OUTRO: "Outro",
};

export function commercialActionLabel(type: string): string {
  return COMMERCIAL_ACTION_LABELS[type] ?? type;
}

export type CreateCommercialActionPayload = {
  type: CommercialActionType;
  description?: string;
  nextContactAt?: string;
};
