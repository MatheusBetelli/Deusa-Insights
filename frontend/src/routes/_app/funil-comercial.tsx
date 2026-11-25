import { CommercialFunnel } from "@/features/pipeline/pages/CommercialFunnel";
import type { DashboardPeriod } from "@/features/dashboard/types/dashboard";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/funil-comercial")({
  validateSearch: (search) => ({
    search: typeof search.search === "string" ? search.search : "",
    uf: typeof search.uf === "string" ? search.uf : "Todos",
    city: typeof search.city === "string" ? search.city : "Todas",
    cnae: typeof search.cnae === "string" ? search.cnae : "Todos",
    period:
      PERIOD_OPTIONS.find((option) => option.value === search.period)?.value ?? "current_month",
    month:
      Number.isInteger(Number(search.month)) &&
      Number(search.month) >= 1 &&
      Number(search.month) <= 12
        ? Number(search.month)
        : new Date().getMonth() + 1,
    year:
      Number.isInteger(Number(search.year)) &&
      Number(search.year) >= 2000 &&
      Number(search.year) <= 2100
        ? Number(search.year)
        : new Date().getFullYear(),
    assignedToId: typeof search.assignedToId === "string" ? search.assignedToId : "Todos",
  }),
  component: CommercialFunnel,
});
const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "selected_month", label: "Mês específico" },
];
