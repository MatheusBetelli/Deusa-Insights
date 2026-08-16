import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  LineChart as LineChartIcon,
  MapPinned,
  PieChart as PieChartIcon,
  RotateCcw,
  Target,
  TrendingUp,
  UserCheck,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PieLabelRenderProps } from "recharts";
import { SkeletonMetricCards } from "@/components/common/InterfaceStates";
import { ESTADOS_UF } from "@/lib/constants";
import { formatCnae } from "@/lib/commercial-formatters";
import { cnaesService } from "@/services/cnaesService";
import { citiesService } from "@/services/citiesService";
import { dashboardService } from "@/services/dashboardService";
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
  inactive: "#C95D63",
};

const POSITIVATION_COLORS: Record<string, string> = {
  positivated: "#22C55E",
  inactive: "#C95D63",
};

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
  { key: "activeClients", name: "Clientes ativos", color: BRAND.blue },
  { key: "positivatedClients", name: "Clientes positivados", color: "#16A34A" },
] as const;

type EvolutionSeriesKey = (typeof EVOLUTION_SERIES)[number]["key"];

function Dashboard() {
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
    setLoading(true);
    setError(null);
    try {
      setSummary(await dashboardService.getSummary(query));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar a Central Comercial.",
      );
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void loadSummary();
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
  const positivationData = useMemo(
    () => filterSegments(positivationComparisonSegments, selectedPositivationKeys),
    [positivationComparisonSegments, selectedPositivationKeys],
  );

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
          .map(
            (key) => portfolioSegments.find((item) => item.key === key)?.name ?? key,
          )
          .join(", "),
        clear: () => setSelectedPortfolioKeys([]),
      });
    }
    if (selectedPositivationKeys.length > 0) {
      filters.push({
        label: "Positivação",
        value: selectedPositivationKeys
          .map(
            (key) =>
              positivationComparisonSegments.find((item) => item.key === key)?.name ?? key,
          )
          .join(", "),
        clear: () => setSelectedPositivationKeys([]),
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
    selectedPortfolioKeys,
    selectedPositivationKeys,
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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
            Comercial
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">
            Central Comercial
          </h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Carteira, positivação, cobertura e expansão territorial da Deusa Alimentos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
      </div>

      <section className="rounded-lg border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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

          <FilterSelect
            label="Responsável"
            value={assignedToId}
            onChange={setAssignedToId}
            disabled={!summary?.filters.responsibles.length}
          >
            <option value="Todos">Todos</option>
            {(summary?.filters.responsibles ?? []).map((item) => (
              <option key={item.id} value={item.id}>
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
        <SkeletonMetricCards count={4} />
      ) : summary ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Carteira de clientes"
              value={summary.portfolio.totalClients}
              description={`${formatNumber(summary.portfolio.activeClients)} ativos na base atual`}
              icon={UserCheck}
              accent={BRAND.blue}
            />
            <MetricCard
              label="Positivados no período"
              value={summary.positivation.total}
              description={`${formatPercent(summary.positivation.portfolioPercentage)} da carteira ativa`}
              icon={CheckCircle2}
              accent="#16A34A"
            />
            <MetricCard
              label="Cobertura comercial"
              value={formatPercent(summary.coverage.percentage)}
              description={`${formatNumber(summary.coverage.clients)} clientes de ${formatNumber(summary.coverage.totalMarket)} pontos mapeados`}
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

          <section className="grid gap-4 xl:grid-cols-3">
            <ChartCard
              eyebrow="Carteira de clientes"
              action={<PeriodLabel>{formatPeriodHeading(summary.period)}</PeriodLabel>}
            >
              <DonutChart
                data={portfolioData}
                total={sumSegments(portfolioData)}
                colors={PORTFOLIO_COLORS}
                centerValue={sumSegments(portfolioData)}
                centerLabel="Clientes"
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
                label={`Detalhar carteira`}
              />
            </ChartCard>

            <ChartCard
              eyebrow="Positivação"
              action={<PeriodLabel>{formatPeriodHeading(summary.period)}</PeriodLabel>}
            >
              <DonutChart
                data={positivationData}
                total={sumSegments(positivationData)}
                colors={POSITIVATION_COLORS}
                centerValue={
                  selectedPositivationKeys.length > 0
                    ? sumSegments(positivationData)
                    : summary.positivation.total
                }
                centerLabel={
                  selectedPositivationKeys.length > 0 ? "Clientes filtrados" : "Clientes positivados"
                }
                emptyMessage="Nenhum cliente foi positivado neste mês"
                emptyLabel="Sem positivação registrada no período"
              />
              <SegmentLegend
                items={positivationComparisonSegments}
                colors={POSITIVATION_COLORS}
                selectedKeys={selectedPositivationKeys}
                onToggle={(key) => toggleIsolatingSelection(key, setSelectedPositivationKeys)}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <PositivationDelta summary={summary} />
                <DetailLink
                  to="/leads-b2b"
                  search={leadSearchBase}
                  label="Detalhar positivação"
                  compact
                />
              </div>
            </ChartCard>

            <ChartCard
              eyebrow="Cobertura de mercado"
              title="Clientes Deusa x oportunidades"
              action={
                <Link
                  to="/mapa-oportunidades"
                  search={mapSearchBase}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#1061AF] hover:underline"
                >
                  Ver oportunidades
                  <ArrowRight className="h-3 w-3" />
                </Link>
              }
            >
              <CoveragePanel summary={summary} />
            </ChartCard>
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
            <ChartCard
              eyebrow="Potencial por município"
              title="Maior espaço comercial disponível"
              action={
                city !== "Todas" ? (
                  <button
                    type="button"
                    onClick={() => setCity("Todas")}
                    className="text-xs font-bold text-[#1061AF] hover:underline"
                  >
                    Remover cidade
                  </button>
                ) : null
              }
            >
              <ExpansionBars
                items={summary.expansionByCity}
                selectedCity={city}
                onSelectCity={(nextCity) => setCity(nextCity)}
                uf={uf}
              />
            </ChartCard>

            <ChartCard
              eyebrow="Evolução comercial"
              title="Séries mensais disponíveis"
              action={
                <SeriesLegend
                  active={activeEvolutionSeries}
                  onToggle={(key) =>
                    setActiveEvolutionSeries((current) =>
                      current.includes(key)
                        ? current.filter((item) => item !== key)
                        : [...current, key],
                    )
                  }
                />
              }
            >
              <EvolutionChart
                data={summary.monthlyEvolution}
                activeSeries={activeEvolutionSeries}
              />
            </ChartCard>
          </section>

          {summary.filters.unsupported.length > 0 && (
            <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
              <div className="font-bold text-[#0B1F33]">Dependências de dados comerciais</div>
              <div className="mt-1 grid gap-1 md:grid-cols-3">
                {summary.filters.unsupported.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </section>
          )}
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
  to: "/leads-b2b";
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

function PositivationDelta({ summary }: { summary: DashboardSummary }) {
  if (!summary.positivation.comparisonAvailable) {
    return <span className="text-xs font-semibold text-[#94A3B8]">Sem base anterior</span>;
  }

  const delta = summary.positivation.deltaPercentage;
  if (delta === null) {
    return <span className="text-xs font-semibold text-[#94A3B8]">Sem base anterior</span>;
  }

  return (
    <span className={`text-xs font-bold ${delta >= 0 ? "text-emerald-700" : "text-red-700"}`}>
      {delta > 0 ? "+" : ""}
      {formatPercent(delta)} vs. período anterior
    </span>
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
      <div className="flex h-[280px] flex-col items-center justify-center rounded-lg bg-white text-center">
        <div className="text-5xl font-light leading-none text-[#334155]">
          {formatNumber(props.centerValue)}
        </div>
        <div className="mt-3 max-w-[180px] text-2xl font-light leading-tight text-[#94A3B8]">
          {props.centerLabel}
        </div>
        {props.emptyMessage ? (
          <div className="mt-12 text-sm font-semibold text-[#64748B]">{props.emptyMessage}</div>
        ) : (
          <div className="mt-8 text-sm font-semibold text-[#64748B]">{props.emptyLabel}</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={78}
            outerRadius={106}
            paddingAngle={2}
            dataKey="count"
            nameKey="name"
            stroke="#FFFFFF"
            strokeWidth={3}
            labelLine={{ stroke: "#CBD5E1", strokeWidth: 1.5 }}
            label={renderDonutPercentLabel}
          >
            {chartData.map((entry) => (
              <Cell key={entry.key} fill={props.colors[entry.key] ?? BRAND.blue} />
            ))}
          </Pie>
          <RechartsTooltip
            formatter={(value: number, _name, item) => {
              const segment = item.payload as DashboardSegment;
              return [
                `${formatNumber(value)} (${formatPercent(segment.percentage)})`,
                segment.name,
              ];
            }}
            contentStyle={{
              backgroundColor: BRAND.navy,
              border: "none",
              borderRadius: 8,
              color: "#FFFFFF",
              fontSize: 12,
            }}
            itemStyle={{ color: "#FFFFFF" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-5xl font-light leading-none text-[#334155]">
          {formatNumber(props.centerValue)}
        </span>
        <span className="mt-2 max-w-[150px] text-center text-2xl font-light leading-tight text-[#94A3B8]">
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
    <div className="mt-2 grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {props.items.map((item) => {
        const isMuted = props.selectedKeys.length > 0 && !props.selectedKeys.includes(item.key);
        const isEmpty = item.count === 0;
        return (
          <button
            key={item.key}
            type="button"
            disabled={isEmpty}
            onClick={() => props.onToggle(item.key)}
            className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md px-1 py-1 text-left transition ${
              isMuted
                ? "bg-white opacity-45"
                : "bg-white hover:bg-[#F8FAFC]"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: props.colors[item.key] ?? BRAND.blue }}
              />
              <span
                className={`truncate text-sm font-semibold ${
                  isEmpty ? "text-[#CBD5E1]" : "text-[#334155]"
                }`}
              >
                {formatNumber(item.count)} {item.name.toLowerCase()}
              </span>
            </span>
            <span
              className={`text-xs font-bold tabular-nums ${
                isEmpty ? "text-[#CBD5E1]" : "text-[#64748B]"
              }`}
            >
              {formatPercent(item.percentage)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CoveragePanel({ summary }: { summary: DashboardSummary }) {
  const clientWidth = clampBarWidth(summary.coverage.percentage, summary.coverage.clients);
  const opportunityWidth = Math.max(0, 100 - clientWidth);

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-xs font-bold uppercase text-[#64748B]">Cobertura comercial</div>
            <div className="mt-1 text-4xl font-black leading-none text-[#0B1F33]">
              {formatPercent(summary.coverage.percentage)}
            </div>
          </div>
          <div className="text-right text-xs font-semibold text-[#64748B]">
            {formatNumber(summary.coverage.totalMarket)} pontos mapeados
          </div>
        </div>
        <div className="mt-4 h-4 overflow-hidden rounded-full bg-[#EAF0F7]">
          <div className="flex h-full w-full">
            <div style={{ width: `${clientWidth}%`, backgroundColor: BRAND.blue }} />
            <div style={{ width: `${opportunityWidth}%`, backgroundColor: "#F59E0B" }} />
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        <CoverageRow
          label="Clientes Deusa"
          value={summary.coverage.clients}
          percentage={summary.coverage.percentage}
          color={BRAND.blue}
        />
        <CoverageRow
          label="Oportunidades"
          value={summary.coverage.opportunities}
          percentage={summary.coverage.expansionPercentage}
          color="#F59E0B"
        />
      </div>
    </div>
  );
}

function CoverageRow(props: { label: string; value: number; percentage: number; color: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-[#EEF2F7] bg-[#F8FAFC] px-3 py-2">
      <div className="flex items-center gap-2 text-xs font-bold text-[#0B1F33]">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: props.color }} />
        {props.label}
      </div>
      <div className="text-xs font-bold tabular-nums text-[#64748B]">
        {formatNumber(props.value)} · {formatPercent(props.percentage)}
      </div>
    </div>
  );
}

function ExpansionBars(props: {
  items: DashboardSummary["expansionByCity"];
  selectedCity: string;
  onSelectCity: (city: string) => void;
  uf: string;
}) {
  if (props.items.length === 0) {
    return (
      <NoData icon={BarChart3} label="Sem municípios com mercado mapeado nos filtros atuais" />
    );
  }

  return (
    <div className="space-y-2">
      {props.items.map((item) => {
        const selected = props.selectedCity === item.city;
        return (
          <div key={item.city} className="grid gap-1">
            <button
              type="button"
              onClick={() => props.onSelectCity(item.city)}
              className={`grid grid-cols-[150px_minmax(0,1fr)_56px] items-center gap-3 rounded-md border px-3 py-2 text-left transition ${
                selected
                  ? "border-[#1061AF] bg-blue-50"
                  : "border-[#EEF2F7] bg-white hover:border-[#1061AF]"
              }`}
            >
              <span className="truncate text-xs font-bold text-[#0B1F33]">{item.city}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-[#EAF0F7]">
                <span
                  className="block h-full rounded-full bg-[#1061AF]"
                  style={{
                    width: `${Math.max(item.expansionPercentage, item.opportunities > 0 ? 4 : 0)}%`,
                  }}
                />
              </span>
              <span className="text-right text-xs font-black tabular-nums text-[#0B1F33]">
                {formatPercent(item.expansionPercentage)}
              </span>
            </button>
            <div className="flex items-center justify-between px-1 text-[11px] font-medium text-[#64748B]">
              <span>
                {formatNumber(item.opportunities)} oportunidades · {formatNumber(item.clients)}{" "}
                clientes
              </span>
              <Link
                to="/mapa-oportunidades"
                search={{
                  uf: props.uf !== "Todos" ? props.uf : undefined,
                  city: item.city,
                }}
                className="font-bold text-[#1061AF] hover:underline"
              >
                Abrir mapa
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvolutionChart(props: {
  data: MonthlyEvolutionPoint[];
  activeSeries: EvolutionSeriesKey[];
}) {
  if (props.data.length === 0) {
    return <NoData icon={LineChartIcon} label="Sem evolução mensal para os filtros atuais" />;
  }

  return (
    <div className="h-[324px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={props.data} margin={{ top: 12, right: 16, left: -16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" />
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
            formatter={(value: number, name: string) => [formatNumber(value), name]}
            labelFormatter={(label, payload) => {
              const point = payload?.[0]?.payload as MonthlyEvolutionPoint | undefined;
              return point ? `${label}/${point.year}` : label;
            }}
            contentStyle={{
              backgroundColor: BRAND.navy,
              border: "none",
              borderRadius: 8,
              color: "#FFFFFF",
              fontSize: 12,
            }}
            itemStyle={{ color: "#FFFFFF" }}
          />
          {EVOLUTION_SERIES.map((series) =>
            props.activeSeries.includes(series.key) ? (
              <Line
                key={series.key}
                type="monotone"
                dataKey={series.key}
                name={series.name}
                stroke={series.color}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ) : null,
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function SeriesLegend(props: {
  active: EvolutionSeriesKey[];
  onToggle: (key: EvolutionSeriesKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {EVOLUTION_SERIES.map((item) => {
        const active = props.active.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => props.onToggle(item.key)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11px] font-bold transition ${
              active
                ? "border-[#DDE5EF] bg-[#F8FAFC] text-[#0B1F33]"
                : "border-[#EEF2F7] bg-white text-[#94A3B8]"
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

function clampBarWidth(value: number, count: number) {
  if (count <= 0) return 0;
  return Math.max(4, Math.min(100, value));
}

function buildYearOptions(currentYear: number) {
  return Array.from({ length: 6 }, (_, index) => currentYear - index);
}
