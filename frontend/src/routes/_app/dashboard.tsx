import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BarChart3,
  Building2,
  CalendarRange,
  CheckCircle2,
  LineChart as LineChartIcon,
  MapPinned,
  RotateCcw,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { ExecutiveCityRanking } from "@/components/dashboard/ExecutiveCityRanking";
import {
  Area,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { SkeletonMetricCards } from "@/components/common/InterfaceStates";
import { formatCnae } from "@/lib/commercial-formatters";
import { cnaesService } from "@/services/cnaesService";
import { citiesService } from "@/services/citiesService";
import { dashboardService } from "@/services/dashboardService";
import { toast } from "sonner";
import type { Cnae } from "@/types/cnae";
import type { City } from "@/types/city";
import type {
  DashboardPeriod,
  DashboardQuery,
  DashboardSegment,
  DashboardSummary,
  MonthlyEvolutionPoint,
} from "@/types/dashboard";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

const BRAND = {
  navy: "#0B1F33",
  blue: "#1061AF",
  muted: "#64748B",
};

const PORTFOLIO_COLORS: Record<string, string> = {
  active: "#22C55E",
  inactive: "#9CA3AF",
  "Clientes Ativos": "#22C55E",
  "Clientes Inativos": "#9CA3AF",
};

const POTENTIAL_COLORS: Record<string, string> = {
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

function getSegmentColor(key: string, colors: Record<string, string>): string {
  if (colors[key]) return colors[key];
  const norm = key.toLowerCase();
  if (norm.includes("crític") || norm.includes("critic")) return "#EF4444";
  if (norm.includes("alto") || norm.includes("high")) return "#F59E0B";
  if (norm.includes("médio") || norm.includes("medio") || norm.includes("medium")) return "#3B82F6";
  if (norm.includes("baixo") || norm.includes("low")) return "#9CA3AF";
  return BRAND.blue;
}

function getShortSegmentName(name: string): string {
  const norm = name.toLowerCase();
  if (norm.includes("crític") || norm.includes("critic")) return "Crítico";
  if (norm.includes("alto") || norm.includes("high")) return "Alto";
  if (norm.includes("médio") || norm.includes("medio") || norm.includes("medium")) return "Médio";
  if (norm.includes("baixo") || norm.includes("low")) return "Baixo";
  if (norm.includes("inativo")) return "Inativos";
  if (norm.includes("ativo")) return "Ativos";
  return name;
}

const RADIAN = Math.PI / 180;

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "selected_month", label: "Mês específico" },
];

const MONTH_OPTIONS = [
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

const EVOLUTION_SERIES = [
  { key: "negotiationsCount", name: "Contatos / Negociações", color: "#94A3B8" },
  { key: "positivatedClients", name: "Clientes positivados", color: "#10B981" },
  { key: "activeClients", name: "Carteira ativa", color: "#2563EB" },
] as const;

type EvolutionSeriesKey = (typeof EVOLUTION_SERIES)[number]["key"];

function Dashboard() {
  const summaryRequestSequence = useRef(0);
  const today = useMemo(() => new Date(), []);
  const [period, setPeriod] = useState<DashboardPeriod>("current_month");
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [uf, setUf] = useState("Todos");
  const [city, setCity] = useState("Todas");
  const [cnae, setCnae] = useState("Todos");
  const [assignedToId, setAssignedToId] = useState("Todos");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPortfolioKeys, setSelectedPortfolioKeys] = useState<string[]>([]);
  const [selectedPositivationKeys, setSelectedPositivationKeys] = useState<string[]>([]);
  const [selectedPotentialKeys, setSelectedPotentialKeys] = useState<string[]>([]);
  const [activeEvolutionSeries, setActiveEvolutionSeries] = useState<EvolutionSeriesKey[]>(
    EVOLUTION_SERIES.map((item) => item.key),
  );

  const query = useMemo<DashboardQuery>(() => {
    const next: DashboardQuery = { period };
    if (period === "selected_month") {
      next.month = month;
      next.year = year;
    }
    if (uf !== "Todos") next.uf = uf;
    if (city !== "Todas") next.city = city;
    if (cnae !== "Todos") next.cnae = cnae;
    if (assignedToId !== "Todos") next.assignedToId = assignedToId;
    return next;
  }, [assignedToId, city, cnae, month, period, uf, year]);

  const loadSummary = useCallback(async () => {
    const requestId = ++summaryRequestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await dashboardService.getSummary(query);
      if (requestId !== summaryRequestSequence.current) return;
      setSummary(nextSummary);
    } catch (err) {
      if (requestId !== summaryRequestSequence.current) return;
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar a Central Comercial.",
      );
    } finally {
      if (requestId === summaryRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSummary();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      summaryRequestSequence.current += 1;
    };
  }, [loadSummary]);

  useEffect(() => {
    async function loadOptions() {
      setOptionsLoading(true);
      try {
        const [cityData, cnaeData] = await Promise.all([
          citiesService.getCities(),
          cnaesService.getCnaes(),
        ]);
        setCities(cityData);
        setCnaes(cnaeData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível carregar os filtros.");
      } finally {
        setOptionsLoading(false);
      }
    }

    void loadOptions();
  }, []);

  const filteredCities = useMemo(
    () => cities.filter((item) => uf === "Todos" || item.uf === uf),
    [cities, uf],
  );

  const portfolioSegments = useMemo(() => buildPortfolioSegments(summary), [summary]);
  const portfolioData = useMemo(
    () => filterSegments(portfolioSegments, selectedPortfolioKeys),
    [portfolioSegments, selectedPortfolioKeys],
  );

  const positivationComparisonSegments = useMemo(
    () => buildPositivationComparisonSegments(summary),
    [summary],
  );
  const potentialSegments = useMemo(() => {
    if (!summary?.potentialDistribution || summary.coverage.opportunities === 0) return [];
    const total = summary.potentialDistribution.reduce((acc, curr) => acc + curr.count, 0);
    if (total === 0) return [];
    return summary.potentialDistribution.map((item) => ({
      key: item.name,
      name: item.name,
      count: item.count,
      percentage: Math.round((item.count / total) * 1000) / 10,
    }));
  }, [summary]);

  const potentialData = useMemo(
    () => filterSegments(potentialSegments, selectedPotentialKeys),
    [potentialSegments, selectedPotentialKeys],
  );

  const hasEnoughEvolutionData = useMemo(() => {
    return Boolean(summary?.monthlyEvolution && summary.monthlyEvolution.length > 0);
  }, [summary]);

  const activeFilters = useMemo(() => {
    const filters: { label: string; value: string; clear: () => void }[] = [];
    if (period !== "current_month") {
      filters.push({
        label: "Período",
        value:
          period === "selected_month"
            ? `${MONTH_OPTIONS[month - 1]}/${year}`
            : (PERIOD_OPTIONS.find((item) => item.value === period)?.label ?? period),
        clear: () => setPeriod("current_month"),
      });
    }
    if (uf !== "Todos") filters.push({ label: "UF", value: uf, clear: () => setUf("Todos") });
    if (city !== "Todas")
      filters.push({ label: "Cidade", value: city, clear: () => setCity("Todas") });
    if (cnae !== "Todos") {
      filters.push({ label: "CNAE", value: formatCnae(cnae), clear: () => setCnae("Todos") });
    }
    if (assignedToId !== "Todos") {
      const responsible = summary?.filters.responsibles.find((item) => item.id === assignedToId);
      filters.push({
        label: "Responsável",
        value: responsible?.name ?? "Selecionado",
        clear: () => setAssignedToId("Todos"),
      });
    }
    if (selectedPortfolioKeys.length > 0) {
      filters.push({
        label: "Carteira",
        value: selectedPortfolioKeys
          .map((key) => portfolioSegments.find((item) => item.key === key)?.name ?? key)
          .join(", "),
        clear: () => setSelectedPortfolioKeys([]),
      });
    }
    if (selectedPositivationKeys.length > 0) {
      filters.push({
        label: "Positivação",
        value: selectedPositivationKeys
          .map(
            (key) => positivationComparisonSegments.find((item) => item.key === key)?.name ?? key,
          )
          .join(", "),
        clear: () => setSelectedPositivationKeys([]),
      });
    }
    if (selectedPotentialKeys.length > 0) {
      filters.push({
        label: "Potencial",
        value: selectedPotentialKeys
          .map((key) => potentialSegments.find((item) => item.key === key)?.name ?? key)
          .join(", "),
        clear: () => setSelectedPotentialKeys([]),
      });
    }
    return filters;
  }, [
    assignedToId,
    city,
    cnae,
    month,
    period,
    portfolioSegments,
    positivationComparisonSegments,
    potentialSegments,
    selectedPortfolioKeys,
    selectedPositivationKeys,
    selectedPotentialKeys,
    summary,
    uf,
    year,
  ]);

  function clearFilters() {
    setPeriod("current_month");
    setMonth(today.getMonth() + 1);
    setYear(today.getFullYear());
    setUf("Todos");
    setCity("Todas");
    setCnae("Todos");
    setAssignedToId("Todos");
    setSelectedPortfolioKeys([]);
    setSelectedPositivationKeys([]);
    setSelectedPotentialKeys([]);
  }

  const leadSearchBase = {
    uf: uf !== "Todos" ? uf : undefined,
    city: city !== "Todas" ? city : undefined,
    cnae: cnae !== "Todos" ? cnae : undefined,
  };

  const mapSearchBase = {
    uf: uf !== "Todos" ? uf : undefined,
    city: city !== "Todas" ? city : undefined,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <Link
          to="/leads-b2b"
          search={{ ...leadSearchBase, status: "CONVERTED" }}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
        >
          <Building2 className="h-3.5 w-3.5 text-[#1061AF]" />
          Ver clientes
        </Link>
        <Link
          to="/mapa-oportunidades"
          search={mapSearchBase}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white transition hover:bg-[#1061AF]"
        >
          <MapPinned className="h-3.5 w-3.5 text-[#FFF200]" />
          Mapa de oportunidades
        </Link>
      </div>

      <section className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <FilterSelect
            label="Período"
            value={period}
            onChange={(value) => setPeriod(value as DashboardPeriod)}
          >
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Mês"
            value={String(month)}
            onChange={(value) => {
              setMonth(Number(value));
              setPeriod("selected_month");
            }}
          >
            {MONTH_OPTIONS.map((label, index) => (
              <option key={label} value={index + 1}>
                {label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect
            label="Ano"
            value={String(year)}
            onChange={(value) => {
              setYear(Number(value));
              setPeriod("selected_month");
            }}
          >
            {buildYearOptions(today.getFullYear()).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Cidade" value={city} onChange={setCity} disabled={optionsLoading}>
            <option value="Todas">Todas</option>
            {filteredCities.map((item) => (
              <option key={item.id} value={item.name}>
                {item.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="CNAE" value={cnae} onChange={setCnae} disabled={optionsLoading}>
            <option value="Todos">Todos</option>
            {cnaes.map((item) => (
              <option key={item.id} value={item.code}>
                {formatCnae(item.code)}
              </option>
            ))}
          </FilterSelect>
        </div>

        <div className="mt-3 flex flex-col gap-2 border-t border-[#EEF2F7] pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-[#0B1F33]">
              {summary?.period.label ?? "Período atual"}
            </span>
            {activeFilters.map((item) => (
              <button
                key={`${item.label}-${item.value}`}
                type="button"
                onClick={item.clear}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-[#DDE5EF] bg-[#F8FAFC] px-2 text-[11px] font-semibold text-[#0B1F33] transition hover:border-[#1061AF]"
              >
                <span className="text-[#64748B]">{item.label}:</span>
                {item.value}
                <X className="h-3 w-3 text-[#94A3B8]" />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex h-8 w-fit items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#1061AF]" />
            Limpar filtros
          </button>
        </div>
      </section>

      {error && (
        <div className="flex flex-col gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 text-sm text-[#7F1D1D] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#ED1C24]" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => void loadSummary()}
            className="h-8 w-fit rounded-md bg-[#0B1F33] px-3 text-xs font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading ? (
        <SkeletonMetricCards count={3} />
      ) : summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <MetricCard
              label="Positivados no período"
              value={summary.positivation.total}
              description={`${formatNumber(summary.portfolio.activeClients)} clientes ativos na base (${formatPercent(summary.positivation.portfolioPercentage)} da carteira)`}
              icon={CheckCircle2}
              accent="#16A34A"
            />
            <MetricCard
              label="Cobertura comercial"
              value={formatPercent(summary.coverage.percentage)}
              description={`${formatNumber(summary.coverage.clients)} clientes de ${formatNumber(summary.coverage.totalMarket)} pontos cadastrados`}
              icon={Target}
              accent={BRAND.navy}
            />
            <MetricCard
              label="Espaço de expansão"
              value={formatPercent(summary.coverage.expansionPercentage)}
              description={`${formatNumber(summary.coverage.opportunities)} oportunidades ainda não atendidas`}
              icon={TrendingUp}
              accent="#F59E0B"
            />
          </section>

          {/* Linha 2: Diagnóstico de Carteira & Potencial Comercial & Evolução Mensal */}
          <section className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              eyebrow="Carteira de clientes"
              title="Composição da Carteira"
              action={<PeriodLabel>{formatPeriodHeading(summary.period)}</PeriodLabel>}
            >
              <DonutChart
                data={portfolioData}
                total={sumSegments(portfolioData)}
                colors={PORTFOLIO_COLORS}
                centerValue={summary.portfolio.activeClients}
                centerLabel="Clientes Ativos"
                emptyLabel="Sem carteira para os filtros atuais"
              />
              <SegmentLegend
                items={portfolioSegments}
                colors={PORTFOLIO_COLORS}
                selectedKeys={selectedPortfolioKeys}
                onToggle={(key) => toggleIsolatingSelection(key, setSelectedPortfolioKeys)}
              />
              <DetailLink
                to="/leads-b2b"
                search={{ ...leadSearchBase, status: "CONVERTED" }}
                label="Detalhar carteira de clientes"
              />
            </ChartCard>

            <ChartCard
              eyebrow="Potencial Comercial"
              title="Oportunidades por Nível"
              action={<PeriodLabel>{formatPeriodHeading(summary.period)}</PeriodLabel>}
            >
              <DonutChart
                data={potentialData}
                total={sumSegments(potentialData)}
                colors={POTENTIAL_COLORS}
                centerValue={sumSegments(potentialData)}
                centerLabel="Oportunidades"
                emptyLabel="Sem oportunidades no período"
              />
              <SegmentLegend
                items={potentialSegments}
                colors={POTENTIAL_COLORS}
                selectedKeys={selectedPotentialKeys}
                onToggle={(key) => toggleIsolatingSelection(key, setSelectedPotentialKeys)}
              />
              <DetailLink
                to="/mapa-oportunidades"
                search={mapSearchBase}
                label="Ver oportunidades no mapa"
              />
            </ChartCard>

            <ChartCard
              eyebrow="Evolução comercial"
              title="Séries Mensais Acumuladas"
              action={<PeriodLabel>{formatPeriodHeading(summary.period)}</PeriodLabel>}
            >
              {hasEnoughEvolutionData ? (
                <EvolutionChart
                  data={summary.monthlyEvolution}
                  activeSeries={activeEvolutionSeries}
                  onToggleSeries={(key) =>
                    setActiveEvolutionSeries((current) =>
                      current.includes(key)
                        ? current.filter((item) => item !== key)
                        : [...current, key],
                    )
                  }
                />
              ) : (
                <div className="flex h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-6 text-center">
                  <CalendarRange className="mb-2.5 h-8 w-8 text-slate-400" />
                  <h4 className="text-sm font-bold text-slate-800">Histórico Mensal em Formação</h4>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Os indicadores consolidados de positivação e ativação dos próximos ciclos
                    mensais alimentarão este gráfico automaticamente.
                  </p>
                  <span className="mt-3.5 rounded-full bg-slate-200/70 px-3 py-1 text-[11px] font-semibold text-slate-700">
                    Módulo Analítico Deusa Insights
                  </span>
                </div>
              )}
            </ChartCard>
          </section>

          {/* Linha 3: Ranking por Município (Espaço Comercial Disponível) */}
          <section>
            <ExecutiveCityRanking
              expansionByCity={summary.expansionByCity}
              selectedCity={city}
              onSelectCity={(nextCity) => setCity(nextCity)}
            />
          </section>
        </>
      ) : (
        <section className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-8 text-center text-sm font-semibold text-[#64748B]">
          Central Comercial indisponível para os filtros atuais.
        </section>
      )}
    </div>
  );
}

function FilterSelect(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
        {props.label}
      </span>
      <select
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm font-semibold text-[#0B1F33] outline-none transition focus:border-[#1061AF] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {props.children}
      </select>
    </label>
  );
}

function MetricCard(props: {
  label: string;
  value: number | string;
  description: string;
  icon: LucideIcon;
  accent: string;
}) {
  const Icon = props.icon;
  return (
    <div className="min-h-[116px] rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
            {props.label}
          </div>
          <div className="mt-2 text-3xl font-black leading-none tracking-tight text-[#0B1F33]">
            {typeof props.value === "number" ? formatNumber(props.value) : props.value}
          </div>
        </div>
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ borderColor: `${props.accent}33`, backgroundColor: `${props.accent}12` }}
        >
          <Icon className="h-4 w-4" style={{ color: props.accent }} />
        </div>
      </div>
      <div className="mt-3 text-xs font-medium leading-snug text-[#64748B]">
        {props.description}
      </div>
    </div>
  );
}

function ChartCard(props: {
  eyebrow: string;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
      <div className="mb-3 flex min-h-9 items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
            {props.eyebrow}
          </div>
          {props.title ? (
            <h2 className="mt-0.5 text-sm font-bold text-[#0B1F33]">{props.title}</h2>
          ) : null}
        </div>
        {props.action && <div className="shrink-0 pt-1">{props.action}</div>}
      </div>
      {props.children}
    </div>
  );
}

function PeriodLabel({ children }: { children: ReactNode }) {
  return (
    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#64748B]">
      {children}
    </span>
  );
}

function DetailLink(props: {
  to: "/leads-b2b" | "/mapa-oportunidades";
  search: Record<string, unknown>;
  label: string;
  compact?: boolean;
}) {
  return (
    <Link
      to={props.to}
      search={props.search}
      className={`inline-flex items-center justify-center gap-2 font-extrabold text-[#2E2478] transition hover:text-[#1061AF] ${
        props.compact ? "text-xs" : "mt-4 w-full border-t border-[#EEF2F7] pt-3 text-sm"
      }`}
    >
      <BarChart3 className="h-4 w-4" />
      {props.label}
    </Link>
  );
}

function renderDonutPercentLabel(props: PieLabelRenderProps) {
  const percent = typeof props.percent === "number" ? props.percent : 0;
  if (percent <= 0) return null;

  const cx = toNumber(props.cx);
  const cy = toNumber(props.cy);
  const outerRadius = toNumber(props.outerRadius);
  const midAngle = typeof props.midAngle === "number" ? props.midAngle : 0;
  const radius = outerRadius + 27;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#334155"
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="text-sm font-extrabold"
    >
      {formatPercent(percent * 100)}
    </text>
  );
}

function DonutChart(props: {
  data: DashboardSegment[];
  total: number;
  colors: Record<string, string>;
  centerValue: number;
  centerLabel: string;
  emptyLabel: string;
  emptyMessage?: string;
}) {
  const chartData = props.data.filter((item) => item.count > 0);
  if (chartData.length === 0) {
    return (
      <div className="flex h-[260px] flex-col items-center justify-center rounded-lg bg-white text-center">
        <div className="text-4xl font-extrabold tracking-tight text-[#0B1F33]">
          {formatNumber(props.centerValue)}
        </div>
        <div className="mt-1 text-xs font-bold uppercase tracking-wider text-[#64748B]">
          {props.centerLabel}
        </div>
        {props.emptyMessage ? (
          <div className="mt-6 text-xs font-semibold text-[#64748B]">{props.emptyMessage}</div>
        ) : (
          <div className="mt-6 text-xs font-semibold text-[#64748B]">{props.emptyLabel}</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={96}
            paddingAngle={3}
            dataKey="count"
            nameKey="name"
            stroke="#FFFFFF"
            strokeWidth={3}
            labelLine={{ stroke: "#CBD5E1", strokeWidth: 1.5 }}
            label={renderDonutPercentLabel}
          >
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={getSegmentColor(entry.key, props.colors)} />
            ))}
          </Pie>
          <RechartsTooltip
            wrapperStyle={{ outline: "none", zIndex: 1000, opacity: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const segment = payload[0].payload as DashboardSegment;
              const color = getSegmentColor(segment.key, props.colors);

              return (
                <div
                  className="rounded-lg border-2 border-slate-700 bg-slate-900 p-3 text-xs shadow-2xl text-white"
                  style={{ backgroundColor: "#0F172A", opacity: 1 }}
                >
                  <div className="flex items-center gap-2 font-bold text-white">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-sm font-bold text-white">{segment.name}</span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-bold tabular-nums">
                    <span className="text-base font-extrabold text-white">
                      {formatNumber(segment.count)}
                    </span>
                    <span className="text-xs font-semibold text-slate-300">
                      ({formatPercent(segment.percentage)})
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
        <span className="text-3xl font-extrabold tracking-tight text-[#0B1F33]">
          {formatNumber(props.centerValue)}
        </span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-[#64748B]">
          {props.centerLabel}
        </span>
      </div>
    </div>
  );
}

function SegmentLegend(props: {
  items: DashboardSegment[];
  colors: Record<string, string>;
  selectedKeys: string[];
  onToggle: (key: string) => void;
}) {
  if (props.items.length === 0) return null;

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {props.items.map((item) => {
        const isMuted = props.selectedKeys.length > 0 && !props.selectedKeys.includes(item.key);
        const isEmpty = item.count === 0;
        const color = getSegmentColor(item.key, props.colors);
        const displayName = getShortSegmentName(item.name);

        return (
          <button
            key={item.key}
            type="button"
            disabled={isEmpty}
            onClick={() => props.onToggle(item.key)}
            title={item.name}
            className={`flex items-center justify-between gap-1.5 rounded-lg border border-slate-100 bg-slate-50/70 px-2.5 py-1.5 text-left transition ${
              isMuted
                ? "opacity-40 cursor-pointer"
                : "hover:border-slate-200 hover:bg-slate-100 cursor-pointer"
            } ${isEmpty ? "cursor-not-allowed" : ""}`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span
                className={`truncate text-xs font-bold ${
                  isEmpty ? "text-slate-400" : "text-slate-700"
                }`}
              >
                {displayName}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums">
              <span className="font-extrabold text-slate-900">{formatNumber(item.count)}</span>
              <span className="text-[11px] font-semibold text-slate-500">
                ({formatPercent(item.percentage)})
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EvolutionChart(props: {
  data: MonthlyEvolutionPoint[];
  activeSeries: EvolutionSeriesKey[];
  onToggleSeries: (key: EvolutionSeriesKey) => void;
}) {
  if (props.data.length === 0) {
    return <NoData icon={LineChartIcon} label="Sem evolução mensal para os filtros atuais" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex w-full items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <span className="text-[11px] font-semibold text-slate-500">Séries Analíticas</span>
        <SeriesLegend active={props.activeSeries} onToggle={props.onToggleSeries} />
      </div>

      <div className="h-[285px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={props.data} margin={{ top: 12, right: 12, left: -20, bottom: 4 }}>
            <defs>
              <linearGradient id="colorPositivated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: BRAND.muted, fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: "#E2E8F0" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: BRAND.muted, fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <RechartsTooltip
              wrapperStyle={{ outline: "none", zIndex: 1000, opacity: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload as MonthlyEvolutionPoint | undefined;
                const periodLabel = point ? `${label}/${point.year}` : label;

                return (
                  <div
                    className="rounded-lg border-2 border-slate-700 bg-slate-900 p-3 text-xs shadow-2xl text-white"
                    style={{ backgroundColor: "#0F172A", opacity: 1 }}
                  >
                    <div className="mb-2 font-bold text-xs uppercase tracking-wider text-slate-300 border-b border-slate-700/80 pb-1">
                      {periodLabel}
                    </div>
                    <div className="space-y-1.5">
                      {payload.map((entry) => (
                        <div
                          key={String(entry.dataKey)}
                          className="flex items-center justify-between gap-4"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: entry.color }}
                            />
                            {entry.name}
                          </span>
                          <span className="font-extrabold text-white tabular-nums">
                            {formatNumber(Number(entry.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
            />

            {props.activeSeries.includes("negotiationsCount") && (
              <Bar
                dataKey="negotiationsCount"
                name="Contatos / Negociações"
                fill="#CBD5E1"
                opacity={0.5}
                radius={[4, 4, 0, 0]}
                barSize={20}
              />
            )}

            {props.activeSeries.includes("positivatedClients") && (
              <Area
                type="monotone"
                dataKey="positivatedClients"
                name="Clientes positivados"
                fill="url(#colorPositivated)"
                stroke="#10B981"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#10B981", strokeWidth: 2, stroke: "#FFFFFF" }}
                activeDot={{ r: 5, fill: "#059669" }}
              />
            )}

            {props.activeSeries.includes("activeClients") && (
              <Line
                type="monotone"
                dataKey="activeClients"
                name="Carteira ativa"
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SeriesLegend(props: {
  active: EvolutionSeriesKey[];
  onToggle: (key: EvolutionSeriesKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {EVOLUTION_SERIES.map((item) => {
        const active = props.active.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onToggle(item.key)}
            className={`inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[10px] font-bold transition ${
              active
                ? "border-slate-300 bg-slate-100 text-slate-800"
                : "border-slate-200 bg-white text-slate-400 opacity-60"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </button>
        );
      })}
    </div>
  );
}

function NoData(props: { icon: LucideIcon; label: string }) {
  const Icon = props.icon;
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 text-center">
      <Icon className="h-5 w-5 text-[#94A3B8]" />
      <div className="mt-2 text-xs font-bold text-[#64748B]">{props.label}</div>
    </div>
  );
}

function toggleIsolatingSelection(key: string, setValue: Dispatch<SetStateAction<string[]>>) {
  setValue((current) => {
    if (current.length === 0) return [key];
    if (current.includes(key)) return current.filter((item) => item !== key);
    return [...current, key];
  });
}

function filterSegments(items: DashboardSegment[], selectedKeys: string[]) {
  return selectedKeys.length > 0 ? items.filter((item) => selectedKeys.includes(item.key)) : items;
}

function buildPortfolioSegments(summary: DashboardSummary | null): DashboardSegment[] {
  if (!summary) return [];
  const total = summary.portfolio.activeClients + summary.portfolio.inactiveClients;
  return [
    makeSegment("active", "Ativos", summary.portfolio.activeClients, total),
    makeSegment("inactive", "Inativos", summary.portfolio.inactiveClients, total),
  ];
}

function buildPositivationComparisonSegments(summary: DashboardSummary | null): DashboardSegment[] {
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

function sumSegments(items: DashboardSegment[]) {
  return items.reduce((total, item) => total + item.count, 0);
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR");
}

function formatPercent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function toNumber(value: string | number | undefined) {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPeriodHeading(period: DashboardSummary["period"]) {
  const start = new Date(period.start);
  if (period.key === "current_month" || period.key === "selected_month") {
    return `${MONTH_OPTIONS[start.getUTCMonth()]} de ${start.getUTCFullYear()}`.toUpperCase();
  }
  return period.label.toUpperCase();
}

function buildYearOptions(currentYear: number) {
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}
