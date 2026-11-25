import type {
  DashboardPeriod,
  DashboardSegment,
  DashboardSummary,
} from "@/features/dashboard/types/dashboard";
import type { Dispatch, SetStateAction } from "react";
export const BRAND = {
  navy: "#0B1F33",
  blue: "#1061AF",
  muted: "#64748B",
};

export const PORTFOLIO_COLORS: Record<string, string> = {
  active: "#22C55E",
  inactive: "#9CA3AF",
  "Clientes Ativos": "#22C55E",
  "Clientes Inativos": "#9CA3AF",
};

export const POTENTIAL_COLORS: Record<string, string> = {
  "Oportunidades Críticas": "#EF4444",
  CRITICAL: "#EF4444",
  Crítica: "#EF4444",
  Crítico: "#EF4444",

  "Alto Potencial": "#F59E0B",
  HIGH: "#F59E0B",
  Alta: "#F59E0B",

  "Médio Potencial": "#3B82F6",
  MEDIUM: "#3B82F6",
  Média: "#3B82F6",

  "Baixo Potencial": "#9CA3AF",
  LOW: "#9CA3AF",
  Baixa: "#9CA3AF",
};

export function getSegmentColor(key: string, colors: Record<string, string>): string {
  if (colors[key]) return colors[key];
  const norm = key.toLowerCase();
  if (norm.includes("crític") || norm.includes("critic")) return "#EF4444";
  if (norm.includes("alto") || norm.includes("high")) return "#F59E0B";
  if (norm.includes("médio") || norm.includes("medio") || norm.includes("medium")) return "#3B82F6";
  if (norm.includes("baixo") || norm.includes("low")) return "#9CA3AF";
  return BRAND.blue;
}

export function getShortSegmentName(name: string): string {
  const norm = name.toLowerCase();
  if (norm.includes("crític") || norm.includes("critic")) return "Crítico";
  if (norm.includes("alto") || norm.includes("high")) return "Alto";
  if (norm.includes("médio") || norm.includes("medio") || norm.includes("medium")) return "Médio";
  if (norm.includes("baixo") || norm.includes("low")) return "Baixo";
  if (norm.includes("inativo")) return "Inativos";
  if (norm.includes("ativo")) return "Ativos";
  return name;
}

export const RADIAN = Math.PI / 180;

export const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "selected_month", label: "Mês específico" },
];

export const MONTH_OPTIONS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export const EVOLUTION_SERIES = [
  { key: "negotiationsCount", name: "Contatos / Negociações", color: "#94A3B8" },
  { key: "positivatedClients", name: "Clientes positivados", color: "#10B981" },
  { key: "activeClients", name: "Carteira ativa", color: "#2563EB" },
] as const;

export type EvolutionSeriesKey = (typeof EVOLUTION_SERIES)[number]["key"];

export function toggleIsolatingSelection(
  key: string,
  setValue: Dispatch<SetStateAction<string[]>>,
) {
  setValue((current) => {
    if (current.length === 0) return [key];
    if (current.includes(key)) return current.filter((item) => item !== key);
    return [...current, key];
  });
}

export function filterSegments(items: DashboardSegment[], selectedKeys: string[]) {
  return selectedKeys.length > 0 ? items.filter((item) => selectedKeys.includes(item.key)) : items;
}

export function buildPortfolioSegments(summary: DashboardSummary | null): DashboardSegment[] {
  if (!summary) return [];
  const total = summary.portfolio.activeClients + summary.portfolio.inactiveClients;
  return [
    makeSegment("active", "Ativos", summary.portfolio.activeClients, total),
    makeSegment("inactive", "Inativos", summary.portfolio.inactiveClients, total),
  ];
}

export function buildPositivationComparisonSegments(
  summary: DashboardSummary | null,
): DashboardSegment[] {
  if (!summary) return [];
  const inactiveClients = summary.portfolio.inactiveClients;
  const positivatedClients = summary.positivation.total;
  const total = positivatedClients + inactiveClients;

  return [
    makeSegment("positivated", "Positivados", positivatedClients, total),
    makeSegment("inactive", "Inativos", inactiveClients, total),
  ];
}

function makeSegment(key: string, name: string, count: number, total: number): DashboardSegment {
  return {
    key,
    name,
    count,
    percentage: pct(count, total),
  };
}

export function sumSegments(items: DashboardSegment[]) {
  return items.reduce((total, item) => total + item.count, 0);
}

export function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

export function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatPeriodHeading(period: DashboardSummary["period"]) {
  const start = new Date(period.start);
  if (period.key === "current_month" || period.key === "selected_month") {
    return `${MONTH_OPTIONS[start.getUTCMonth()]} de ${start.getUTCFullYear()}`.toUpperCase();
  }
  return period.label.toUpperCase();
}

export function buildYearOptions(currentYear: number) {
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}
