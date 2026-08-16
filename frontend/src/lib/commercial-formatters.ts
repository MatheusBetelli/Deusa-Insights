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

export function formatRelativeTime(dateString?: string | null): string {
  if (!dateString) return "Hoje";
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `Há ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Há ${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ontem";
  if (diffDays < 7) return `Há ${diffDays} dias`;
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(value: number, decimals: number = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  }).format(value) + "%";
}
