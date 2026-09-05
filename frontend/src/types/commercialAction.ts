export const COMMERCIAL_ACTION_TYPES = [
  "VISITA",
  "LIGACAO",
  "WHATSAPP",
  "EMAIL",
  "REUNIAO",
  "RETORNO",
  "SEM_INTERESSE",
  "OUTRO",
] as const;

export type CommercialActionType = (typeof COMMERCIAL_ACTION_TYPES)[number];

export type CreateCommercialActionPayload = {
  type: CommercialActionType;
  description?: string;
};
