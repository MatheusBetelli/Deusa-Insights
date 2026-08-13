import { createFileRoute, Link } from "@tanstack/react-router";
import { SkeletonMetricCards } from "@/components/common/InterfaceStates";
import { ScoreBreakdownTooltip } from "@/components/common/ScoreBreakdownTooltip";
import { dashboardService } from "@/services/dashboardService";
import type { DashboardSummary } from "@/types/dashboard";
import { useEffect, useState } from "react";
import { ESTADOS_UF } from "@/lib/constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  LineChart as LineChartIcon,
  MapPin,
  MessageSquare,
  PieChart as PieChartIcon,
  Sparkles,
  Target,
  TrendingUp,
  UserX,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const PIE_COLORS = ["#1061AF", "#38BDF8", "#F59E0B", "#16A34A", "#94A3B8", "#ED1C24"];

function Dashboard() {
  const [uf, setUf] = useState("Todos");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMetricHelpModal, setShowMetricHelpModal] = useState(false);

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
      value: summary?.potentialClients ?? 410,
      icon: Sparkles,
      iconColor: "text-[#1061AF]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Clientes ativos",
      description: "Com relacionamento comercial em curso",
      value: summary?.activeClients ?? 12,
      icon: CheckCircle2,
      iconColor: "text-[#16A34A]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Clientes inativos",
      description: "Sem contato ou desqualificados",
      value: summary?.inactiveClients ?? 8,
      icon: UserX,
      iconColor: "text-[#94A3B8]",
      valueColor: "text-[#0B1F33]",
      alert: false,
    },
    {
      label: "Oportunidades críticas (Total)",
      description: "Leads de score alto (80-100) em toda a base",
      value: summary?.criticalOpportunities ?? 28,
      icon: AlertTriangle,
      iconColor: "text-[#ED1C24]",
      valueColor: "text-[#C81920]",
      alert: true,
    },
  ];

  const priorityCity = summary?.priorityCity ?? "Bastos";
  const pMetrics = summary?.priorityMetrics ?? {
    territorialScore: 91,
    criticalCount: 12,
    qualifiedCount: 34,
    distanceGarcaKm: 48,
    cnaeFocusDescription: "Alta concentração de CNAEs estratégicos",
  };

  const topRegions = summary?.topRegions ?? [
    { rank: 1, city: "Bastos", territorialScore: 91, criticalCount: 12, qualifiedCount: 34, totalCompanies: 40, distanceGarcaKm: 48, cnaeFocusDescription: "Alta concentração" },
    { rank: 2, city: "Tupã", territorialScore: 84, criticalCount: 8, qualifiedCount: 28, totalCompanies: 32, distanceGarcaKm: 85, cnaeFocusDescription: "Alta concentração" },
    { rank: 3, city: "Marília", territorialScore: 78, criticalCount: 5, qualifiedCount: 22, totalCompanies: 28, distanceGarcaKm: 25, cnaeFocusDescription: "Alta concentração" },
  ];

  const recommendedActions = [
    {
      icon: AlertTriangle,
      title: `${pMetrics.criticalCount} leads de alta prioridade sem responsável em ${priorityCity}`,
      description: "Leads com score >= 80 aguardando primeira abordagem da equipe.",
      actionText: "Atribuir responsáveis →",
      to: "/leads-b2b" as const,
      search: { city: priorityCity, potentialLevel: "CRITICAL" },
      primary: true,
    },
    {
      icon: Building2,
      title: `Região de ${priorityCity} concentra ${pMetrics.qualifiedCount} pontos de venda`,
      description: "Visualização territorial de adensamento comercial para rotas.",
      actionText: "Visualizar no mapa →",
      to: "/mapa-oportunidades" as const,
      search: { city: priorityCity },
      primary: false,
    },
    {
      icon: MessageSquare,
      title: `${(summary?.potentialClients ?? 410).toLocaleString("pt-BR")} leads na etapa inicial sem contato`,
      description: "Primeira abordagem para avanço nas etapas do funil comercial.",
      actionText: "Acompanhar funil →",
      to: "/funil-comercial" as const,
      search: { search: "", uf: "Todos", city: priorityCity, cnae: "Todos" },
      primary: false,
    },
  ];

  const statusPieData = summary?.statusDistribution ?? [
    { name: "Novos Leads", count: summary?.potentialClients ?? 410 },
    { name: "Convertidos", count: summary?.activeClients ?? 12 },
    { name: "Inativos", count: summary?.inactiveClients ?? 8 },
  ];

  const cityBarData = summary?.cityDistribution ?? [
    { city: "Bastos", total: 180 },
    { city: "Tupã", total: 95 },
    { city: "Presidente Prudente", total: 60 },
    { city: "Gália", total: 40 },
    { city: "Ribeirão Preto", total: 25 },
    { city: "Bauru", total: 11 },
  ];

  const trendLineData = summary?.monthlyTrend ?? [
    { mes: "Mai", novosLeads: 160, convertidos: 5 },
    { mes: "Jun", novosLeads: 260, convertidos: 12 },
    { mes: "Jul", novosLeads: 350, convertidos: 20 },
    { mes: "Ago", novosLeads: summary?.potentialClients ?? 410, convertidos: summary?.activeClients ?? 12 },
  ];

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
            Dashboard Executive & Analytics
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">
            Central Comercial
          </h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Visão rápida das principais oportunidades de expansão B2B da Deusa Alimentos.
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
          {summaryCards.map((card, idx) => {
            const Icon = card.icon;
            const topBorders = [
              "border-t-4 border-[#1061AF]",
              "border-t-4 border-emerald-500",
              "border-t-4 border-slate-300",
              "border-t-4 border-[#ED1C24]",
            ];
            return (
              <div
                key={card.label}
                className={`relative flex min-h-[116px] flex-col justify-between overflow-hidden rounded-xl border bg-white p-4 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  topBorders[idx % topBorders.length]
                } ${card.alert ? "border-red-200/80 bg-red-50/10" : "border-[#DDE5EF]"}`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`text-[2.1rem] font-black leading-none tabular-nums tracking-tight ${card.valueColor}`}
                  >
                    {card.value.toLocaleString("pt-BR")}
                  </div>
                  {card.alert && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                      Urgente
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12.5px] font-bold leading-tight text-[#0B1F33]">
                      {card.label}
                    </div>
                    <div className="mt-0.5 text-[11px] font-medium leading-snug text-slate-400">
                      {card.description}
                    </div>
                  </div>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-50 border border-slate-100 shrink-0">
                    <Icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Priority + Ranking Discreto + Actions ── */}
      <div className="grid gap-3 xl:grid-cols-[1fr_340px]">
        {/* Banner Principal de Prioridade */}
        <div className="flex flex-col overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-xs transition-all hover:shadow-md">
          {/* Header Band */}
          <div className="border-b border-[#DDE5EF] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
                Prioridade Territorial da Semana
              </span>
              <button
                onClick={() => setShowMetricHelpModal(true)}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-[#1061AF] transition-colors cursor-pointer"
                title="Como é calculada esta prioridade?"
              >
                <HelpCircle className="h-3.5 w-3.5" />
                <span>Como é calculada?</span>
              </button>
            </div>

            <div className="mt-1 flex items-baseline gap-2">
              <h2 className="text-xl font-bold tracking-tight text-[#0B1F33]">
                {priorityCity}
              </h2>
              <span className="text-[11px] font-medium text-slate-400">
                Score {pMetrics.territorialScore}/100
              </span>
            </div>

            <p className="mt-0.5 text-xs text-[#64748B] font-normal">
              {pMetrics.criticalCount} oportunidades críticas em {priorityCity} · {pMetrics.qualifiedCount} qualificadas · {pMetrics.distanceGarcaKm} km da base
            </p>
          </div>

          {/* Table / Preview list of Top Opportunities in Priority City */}
          <div className="p-4 space-y-2 flex-1 bg-white">
            <div className="text-xs font-bold text-[#0B1F33]">
              Principais oportunidades em {priorityCity}
            </div>

            <div className="divide-y divide-slate-100">
              <div className="flex items-center justify-between py-1.5 hover:bg-[#F8FAFC] px-1 rounded transition-colors">
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#0B1F33] truncate">Conveniência Talismã</span>
                  <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">CNAE 4712-1/00 · Novo lead</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <ScoreBreakdownTooltip
                    score={95}
                    variant="subtle"
                    breakdown={{
                      perfilPts: 30,
                      potencialPts: 25,
                      logisticaPts: 17,
                      dadosPts: 10,
                      prontidaoPts: 8,
                      territorioPts: 5,
                      distanceKm: pMetrics.distanceGarcaKm,
                    }}
                  />
                  <Link to="/leads-b2b" search={{ city: priorityCity }} className="text-xs font-medium text-[#1061AF] hover:underline flex items-center gap-0.5">
                    Ver <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="flex items-center justify-between py-1.5 hover:bg-[#F8FAFC] px-1 rounded transition-colors">
                <div className="min-w-0 flex-1 flex items-baseline gap-2">
                  <span className="text-xs font-semibold text-[#0B1F33] truncate">Mini Mercearia São Francisco</span>
                  <span className="text-[11px] text-slate-400 font-normal truncate hidden sm:inline">CNAE 4712-1/00 · Novo lead</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <ScoreBreakdownTooltip
                    score={90}
                    variant="subtle"
                    breakdown={{
                      perfilPts: 30,
                      potencialPts: 21,
                      logisticaPts: 17,
                      dadosPts: 9,
                      prontidaoPts: 8,
                      territorioPts: 5,
                      distanceKm: pMetrics.distanceGarcaKm,
                    }}
                  />
                  <Link to="/leads-b2b" search={{ city: priorityCity }} className="text-xs font-medium text-[#1061AF] hover:underline flex items-center gap-0.5">
                    Ver <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Ranking Territorial das Próximas Regiões (Lista integrada limpa) */}
          <div className="border-t border-[#DDE5EF] bg-[#F8FAFC]/50 px-4 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-[#0B1F33]">
                Ranking territorial
              </span>
              <span className="text-[11px] text-slate-400 font-medium">Prioridade comercial ponderada</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              {topRegions.slice(0, 3).map((reg, idx) => {
                const isSelected = reg.city === priorityCity || idx === 0;
                return (
                  <Link
                    key={reg.city}
                    to="/leads-b2b"
                    search={{ city: reg.city }}
                    className={`inline-flex items-center gap-1 transition-colors hover:text-[#1061AF] ${
                      isSelected
                        ? "font-bold text-[#1061AF]"
                        : "font-normal text-slate-600"
                    }`}
                  >
                    <span>{idx + 1}. {reg.city}</span>
                    <span className="font-medium tabular-nums text-slate-400">({reg.territorialScore})</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* CTA button (Único) */}
          <div className="border-t border-[#DDE5EF] bg-white px-4 py-2.5">
            <Link
              to="/leads-b2b"
              search={{ city: priorityCity, potentialLevel: "CRITICAL" }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1061AF] px-3 text-xs font-medium text-white transition-colors hover:bg-[#0E467D]"
            >
              Ver oportunidades de {priorityCity}
            </Link>
          </div>
        </div>

        {/* Recommended Actions */}
        <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#DDE5EF] bg-[#F8FAFC] px-4 py-2.5">
            <Sparkles className="h-3 w-3 text-[#1061AF]" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
              Ações recomendadas
            </span>
          </div>

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
                  {action.primary && (
                    <span className="absolute inset-y-0 left-0 w-[3px] rounded-r-full bg-[#1061AF]" />
                  )}

                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      action.primary
                        ? "bg-[#1061AF] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] group-hover:bg-[#EEF2F7]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div
                      className={`truncate text-xs leading-tight ${
                        action.primary ? "font-bold text-[#0B1F33]" : "font-semibold text-[#0B1F33]"
                      }`}
                    >
                      {action.title}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-[#64748B]">
                      {action.description}
                    </div>
                  </div>

                  <span className="text-xs font-semibold text-[#1061AF] group-hover:underline shrink-0 flex items-center gap-0.5">
                    {action.actionText}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── SEÇÃO DE GRÁFICOS & RECOMENDAÇÕES COMERCIAIS ── */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center justify-between border-b border-[#DDE5EF] pb-3">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#1061AF]" />
              <h2 className="text-lg font-bold text-[#0B1F33]">
                Painel Analítico
              </h2>
            </div>
            <p className="text-xs text-[#64748B] mt-0.5">
              Visão por município, distribuição por etapa e evolução de qualificação.
            </p>
          </div>
        </div>

        {/* ── Grid de Gráficos ── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {/* Gráfico 1: Colunas / Barras (Concentração por Município) */}
          <div className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="h-4 w-4 text-[#1061AF]" />
              <h3 className="text-xs font-bold text-[#0B1F33]">Leads por Município Foco</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cityBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="city" tick={{ fontSize: 11, fill: "#64748B" }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0B1F33", borderRadius: "8px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Bar dataKey="total" fill="#1061AF" radius={[6, 6, 0, 0]} name="Oportunidades" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-500 text-center">
              Volume absoluto de estabelecimentos mapeados por cidade
            </p>
          </div>

          {/* Gráfico 2: Barras / Distribuição Comparativa do Funil */}
          <div className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <PieChartIcon className="h-4 w-4 text-[#1061AF]" />
              <h3 className="text-xs font-bold text-[#0B1F33]">Distribuição do Funil</h3>
            </div>
            <div className="py-2 space-y-4 my-auto">
              {statusPieData.map((item, idx) => {
                const total = statusPieData.reduce((acc, curr) => acc + curr.count, 0) || 1;
                const pct = Math.round((item.count / total) * 100);
                const barColors = ["bg-[#1061AF]", "bg-[#16A34A]", "bg-[#94A3B8]"];
                return (
                  <div key={item.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-[#0B1F33]">
                      <span>{item.name}</span>
                      <span className="tabular-nums font-bold text-slate-600">
                        {item.count.toLocaleString("pt-BR")} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColors[idx % barColors.length]}`}
                        style={{ width: `${Math.max(pct, item.count > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-500 text-center">
              Proporção de leads por etapa comercial (Novos x Contatados x Convertidos)
            </p>
          </div>

          {/* Gráfico 3: Linhas (Tendência e Projeção Comercial) */}
          <div className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-xs md:col-span-2 xl:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <LineChartIcon className="h-4 w-4 text-[#16A34A]" />
              <h3 className="text-xs font-bold text-[#0B1F33]">Tendência de Qualificação</h3>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendLineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#64748B" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "#0B1F33", borderRadius: "8px", border: "none", color: "#fff", fontSize: "12px" }}
                  />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "6px" }} />
                  <Line type="monotone" dataKey="novosLeads" stroke="#1061AF" strokeWidth={2.5} dot={{ r: 4 }} name="Leads Mapeados" />
                  <Line type="monotone" dataKey="convertidos" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 4 }} name="Convertidos" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-[11px] font-medium text-slate-500 text-center">
              Evolução mensal de prospecção (Leads Mapeados vs Convertidos)
            </p>
          </div>
        </div>

        {/* ── Componente de Recomendações Comerciais ── */}
        <div className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-xs">
          <div className="flex items-center gap-2 border-b border-[#DDE5EF] bg-[#F8FAFC] px-4 py-2.5">
            <TrendingUp className="h-4 w-4 text-[#1061AF]" />
            <h3 className="text-xs font-bold text-[#0B1F33]">
              Recomendações comerciais
            </h3>
          </div>

          <div className="divide-y divide-slate-100">
            {/* Item 1 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-[#F8FAFC] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#0B1F33]">Alocação de equipe</div>
                <div className="mt-0.5 text-xs text-[#64748B] font-normal">
                  <strong className="font-semibold text-slate-800">{priorityCity}</strong> e <strong className="font-semibold text-slate-800">{topRegions[1]?.city ?? "Tupã"}</strong> concentram mais de 60% dos leads de maior score.
                </div>
              </div>
              <Link
                to="/leads-b2b"
                search={{ city: priorityCity }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1061AF] hover:underline shrink-0"
              >
                Ver cidades <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Item 2 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-[#F8FAFC] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#0B1F33]">Foco de produto</div>
                <div className="mt-0.5 text-xs text-[#64748B] font-normal">
                  CNAE <strong className="font-semibold text-slate-800">4712-1/00 (Minimercados)</strong> possui a maior concentração de oportunidades.
                </div>
              </div>
              <Link
                to="/leads-b2b"
                search={{ cnae: "4712-1/00" }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1061AF] hover:underline shrink-0"
              >
                Ver oportunidades <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {/* Item 3 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-[#F8FAFC] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold text-[#0B1F33]">Aceleração do funil</div>
                <div className="mt-0.5 text-xs text-[#64748B] font-normal">
                  <strong className="font-semibold text-slate-800">{(summary?.potentialClients ?? 410).toLocaleString("pt-BR")} leads</strong> aguardam primeira abordagem.
                </div>
              </div>
              <Link
                to="/funil-comercial"
                search={{ search: "", uf: "Todos", city: priorityCity, cnae: "Todos" }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#1061AF] hover:underline shrink-0"
              >
                Ver funil <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODAL EXPLICATIVO: "Como é calculada?" ── */}
      <Dialog open={showMetricHelpModal} onOpenChange={setShowMetricHelpModal}>
        <DialogContent className="border border-slate-200/80 bg-white p-6 sm:max-w-[620px] overflow-hidden rounded-2xl shadow-2xl text-slate-800">
          <DialogHeader className="border-b border-slate-100 pb-3 mb-4">
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-[#0B1F33]">
              <Target className="h-5 w-5 text-[#1061AF]" />
              Metodologia de Cálculo de Scores e Priorização
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Bloco 1: Score de Oportunidade Individual */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2">
              <h3 className="text-sm font-black text-[#0B1F33] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1061AF] text-white text-[10px]">1</span>
                Score de Oportunidade do Comércio (0 a 100)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cada estabelecimento recebe uma pontuação única, explicável e reproduzível calculada pela soma ponderada de 6 pilares normalizados:
              </p>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">30% — Perfil / CNAE:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">Minimercados (4712-1/00) e Supermercados (4711-3/02) pontuam máximo (30 pts).</div>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">25% — Potencial Comercial:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">Porte da empresa (EPP = 25 pts, ME = 20 pts, Matriz Ativa = 15 pts).</div>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">20% — Proximidade Logística:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">Distância até Garça/SP (sede Deusa). Até 30 km = 20 pts, decrescendo por raio.</div>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">10% — Qualidade dos Dados:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">CNPJ válido, endereço completo, telefone e localização geocodificada.</div>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">10% — Prontidão Comercial:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">Empresas com situação ATIVA e prontas para primeira abordagem comercial.</div>
                </div>

                <div className="rounded-lg bg-white p-2.5 border border-slate-200/60">
                  <strong className="text-[#1061AF]">5% — Atratividade Territorial:</strong>
                  <div className="text-[11px] text-slate-500 mt-0.5">Localização em municípios polo/monitorados de alta densidade B2B.</div>
                </div>
              </div>

              <div className="mt-2 text-[11px] font-semibold text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                Classificação: <span className="text-red-600 font-bold">80-100 (Crítica)</span> | <span className="text-amber-600 font-bold">65-79 (Alta)</span> | <span className="text-blue-600 font-bold">45-64 (Média)</span> | <span className="text-slate-500 font-bold">0-44 (Baixa)</span>
              </div>
            </div>

            {/* Bloco 2: Prioridade Territorial da Cidade */}
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 space-y-2">
              <h3 className="text-sm font-black text-[#0B1F33] flex items-center gap-1.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0B1F33] text-white text-[10px]">2</span>
                Prioridade Territorial da Semana (Score da Cidade 0 a 100)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                A cidade campeã não é escolhida por quantidade bruta, mas sim pela qualidade e eficiência da região:
              </p>
              <ul className="list-disc pl-4 text-xs space-y-1 text-slate-700">
                <li><strong>35% Média de Qualidade dos Comércios</strong>: Média dos scores individuais dos estabelecimentos da cidade.</li>
                <li><strong>20% Proximidade Logística de Garça/SP</strong>: Eficiência nas entregas e custo de transporte.</li>
                <li><strong>15% Concentração de CNAEs Estratégicos</strong>: Densidade de pontos de venda com alto giro.</li>
                <li><strong>15% Volume de Oportunidades Qualificadas</strong>: Cidades com maior concentração de scores &gt;= 65.</li>
                <li><strong>15% Qualidade Cadastral da Região</strong>: Precisão nos dados para abordagem sem desperdício.</li>
              </ul>
              <div className="text-[11px] text-slate-500 italic bg-amber-50 p-2 rounded-lg border border-amber-200 text-amber-900 mt-2">
                Uma cidade com 15 oportunidades de score 85 terá prioridade maior que uma cidade com 70 comércios de score 35.
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-3 flex justify-end">
            <button
              onClick={() => setShowMetricHelpModal(false)}
              className="h-9 rounded-xl bg-[#0B1F33] px-5 text-xs font-bold text-white transition hover:bg-[#1061AF]"
            >
              Entendido
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
