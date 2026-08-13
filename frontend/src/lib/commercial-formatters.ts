import type { LeadStatus, PotentialLevel } from "@/types/lead";

export const statusLabels: Record<LeadStatus, string> = {
  NEW: "Novo",
  NO_CONTACT: "Sem contato",
  CONTACTED: "Contatado",
  INTERESTED: "Interessado",
  NEGOTIATION: "Em negociação",
  CONVERTED: "Convertido",
  NOT_INTERESTED: "Descartado",
  INACTIVE: "Inativo",
};

export const potentialLabels: Record<PotentialLevel, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
  CRITICAL: "Crítico",
};

export function formatCnpj(value?: string | null) {
  if (!value || value.startsWith("G-") || value.startsWith("GOOGLE-")) {
    return "Não disponível";
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return "Não disponível";
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

export function formatCnae(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length !== 7) return value || "-";
  return digits.replace(/^(\d{4})(\d)(\d{2})$/, "$1-$2/$3");
}

export function formatDateTime(value?: string | null) {
  if (!value) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function companyName(company: { nomeFantasia?: string | null; razaoSocial: string }) {
  return company.nomeFantasia || company.razaoSocial;
}
