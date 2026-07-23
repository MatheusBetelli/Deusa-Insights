import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonMetricCards } from "@/components/app/InterfaceStates";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary } from "@/types/dashboard";
import { useEffect, useState } from "react";
import { ESTADOS_UF } from "@/lib/constants";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Sparkles,
  Target,
  UserX,
} from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const [uf, setUf] = useState("Todos");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      setSummary(await dashboardService.getSummary(uf));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar a Central Comercial.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, [uf]);

  const summaryCards = [
    {
      label: "Potenciais clientes",
      description: "Leads ativos aguardando abordagem",
      value: summary?.potentialClients ?? 0,
      icon: Sparkles,
      iconColor: "text-[#1061AF]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Clientes ativos",
      description: "Com relacionamento comercial em curso",
      value: summary?.activeClients ?? 0,
      icon: CheckCircle2,
      iconColor: "text-[#16A34A]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Clientes inativos",
      description: "Sem contato ou desqualificados",
      value: summary?.inactiveClients ?? 0,
      icon: UserX,
      iconColor: "text-[#94A3B8]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Oportunidades críticas",
      description: "Score alto — ação imediata recomendada",
      value: summary?.criticalOpportunities ?? 0,
      icon: AlertTriangle,
      // only the value number and the icon use red; everything else stays neutral
      iconColor: "text-[#ED1C24]",
      valueColor: "text-[#C81920]",
      alert: true,
    },
  ];
  const priorityCity = summary?.priorityCity ?? "Todas";
  const recommendedActions = [
    {
      icon: AlertTriangle,
      title: "Distribuir leads críticos",
      description: "Atribua responsáveis e acione oportunidades de maior impacto.",
      to: "/leads-b2b" as const,
      search: { city: priorityCity, potentialLevel: "CRITICAL" },
      primary: true,
    },
    {
      icon: Building2,
      title: "Ver mapa da cidade foco",
      description: "Abra oportunidades territorialmente no mapa comercial.",
      to: "/mapa-oportunidades" as const,
      search: { city: priorityCity },
      primary: false,
    },
    {
      icon: MessageSquare,
      title: "Acompanhar funil da semana",
      description: "Revise as etapas comerciais dos leads da prioridade.",
      to: "/funil-comercial" as const,
      search: { city: priorityCity },
      primary: false,
    },
  ];

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
            Dashboard
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">
            Central Comercial
          </h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Visão rápida das principais oportunidades de expansão B2B
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <select
            value={uf}
            onChange={(e) => setUf(e.target.value)}
            className="h-9 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] outline-none focus:border-[#1061AF]"
          >
            <option value="Todos">Todos (UF)</option>
            {ESTADOS_UF.map((estado) => (
              <option key={estado} value={estado}>
                {estado}
              </option>
            ))}
          </select>
          <Link
            to="/leads-b2b"
            search={{ potentialLevel: "CRITICAL" }}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-sm font-bold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF]"
          >
            <Building2 className="h-4 w-4" />
            Ver leads
          </Link>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#ED1C24]" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadSummary}
            className="h-7 w-fit rounded-md bg-[#0B1F33] px-3 text-xs font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Metric Cards ── */}
      {loading ? (
        <SkeletonMetricCards count={4} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                  card.alert ? "border-[#E5C5C6]" : "border-[#DDE5EF]"
                }`}
              >
                {/* Value */}
                <div
                  className={`text-[2.1rem] font-bold leading-none tabular-nums tracking-tight ${card.valueColor}`}
                >
                  {card.value.toLocaleString("pt-BR")}
                </div>

                {/* Label + description + icon */}
                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-semibold leading-tight text-[#0B1F33]">
                      {card.label}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                      {card.description}
                    </div>
                  </div>
                  <Icon className={`h-[15px] w-[15px] shrink-0 ${card.iconColor}`} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Priority + Actions ── */}
      <div className="grid gap-3 xl:grid-cols-[1fr_320px]">
        {/* Priority card */}
        <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
          {/* Dark header band */}
          <div className="bg-[#0B1F33] px-5 pt-4 pb-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Target className="h-3 w-3 shrink-0 text-[#FFF200]" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#FFF200]">
                    Prioridade da semana
                  </span>
                </div>
                <h2 className="mt-1 truncate text-xl font-bold leading-tight text-white">
                  {summary?.priorityCity ?? "Sem prioridade definida"}
                </h2>
              </div>
              <span className="shrink-0 rounded-full border border-[#ED1C24]/40 bg-[#ED1C24]/12 px-2 py-0.5 text-[10px] font-bold text-[#ED1C24]">
                ● Crítico
              </span>
            </div>
          </div>

          {/* Stat pills */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[#DDE5EF] px-5 py-3">
            <div className="flex items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-[#F8FAFC] px-2.5 py-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#94A3B8]">
                CNAE
              </span>
              <span className="text-[12px] font-bold text-[#0B1F33]">
                {summary?.priorityCnae ?? "–"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-[#F8FAFC] px-2.5 py-1.5">
              <AlertTriangle className="h-3 w-3 text-[#ED1C24]" />
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Críticas
              </span>
              <span className="text-[13px] font-bold tabular-nums text-[#C81920]">
                {(summary?.criticalOpportunities ?? 0).toLocaleString("pt-BR")}
              </span>
            </div>
          </div>

          {/* CTA buttons */}
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <Link
              to="/leads-b2b"
              search={{ city: priorityCity, potentialLevel: "CRITICAL" }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-bold text-white transition hover:bg-[#1061AF]"
            >
              <Building2 className="h-3.5 w-3.5 text-[#FFF200]" />
              Ver leads críticos
            </Link>
            <Link
              to="/mapa-oportunidades"
              search={{ uf: "Todos", city: priorityCity }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF]"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              Ver no mapa
            </Link>
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-[#DDE5EF] bg-[#F8FAFC] px-4 py-2.5">
            <Sparkles className="h-3 w-3 text-[#1061AF]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
              Ações recomendadas
            </span>
          </div>

          {/* Action rows */}
          <div className="divide-y divide-[#F1F5F9]">
            {recommendedActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  to={action.to}
                  search={action.search}
                  className={`group relative flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F8FAFC] ${
                    action.primary ? "bg-[#F8FAFC]" : ""
                  }`}
                >
                  {/* Primary accent bar */}
                  {action.primary && (
                    <span className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-[#1061AF]" />
                  )}

                  {/* Icon — same size for all */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      action.primary
                        ? "bg-[#0B1F33] text-[#FFF200]"
                        : "bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EEF2F7]"
                    }`}
                  >
                    <Icon className="h-[14px] w-[14px]" />
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-[12.5px] leading-tight ${
                        action.primary ? "font-bold text-[#0B1F33]" : "font-semibold text-[#0B1F33]"
                      }`}
                    >
                      {action.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[#94A3B8]">
                      {action.description}
                    </div>
                  </div>

                  {/* Chevron */}
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#C8D4E3] transition-colors group-hover:text-[#1061AF]" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
