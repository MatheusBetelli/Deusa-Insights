import { SkeletonMetricCards } from "@/components/common/InterfaceStates";
import { ExecutiveCityRanking } from "@/features/dashboard/components/ExecutiveCityRanking";
import { formatCnae } from "@/lib/commercial-formatters";
import { citiesService } from "@/features/territories/api/citiesService";
import { cnaesService } from "@/features/classification/api/cnaesService";
import { dashboardService } from "@/features/dashboard/api/dashboardService";
import type { City } from "@/features/territories/types/city";
import type { Cnae } from "@/features/classification/types/cnae";
import type {
  DashboardPeriod,
  DashboardQuery,
  DashboardSummary,
} from "@/features/dashboard/types/dashboard";
import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CalendarRange,
  CheckCircle2,
  MapPinned,
  RotateCcw,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChartCard,
  DetailLink,
  DonutChart,
  EvolutionChart,
  FilterSelect,
  MetricCard,
  PeriodLabel,
  SegmentLegend,
} from "../components/DashboardCharts";
import {
  BRAND,
  buildPortfolioSegments,
  buildPositivationComparisonSegments,
  buildYearOptions,
  EVOLUTION_SERIES,
  EvolutionSeriesKey,
  filterSegments,
  formatNumber,
  formatPercent,
  formatPeriodHeading,
  MONTH_OPTIONS,
  PERIOD_OPTIONS,
  PORTFOLIO_COLORS,
  POTENTIAL_COLORS,
  sumSegments,
  toggleIsolatingSelection,
} from "../model/dashboard-model";
export function Dashboard() {
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

  const mapSearchBase = {
    uf: uf !== "Todos" ? uf : undefined,
    city: city !== "Todas" ? city : undefined,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end gap-2">
        <Link
          to="/funil-comercial"
          search={{
            search: "",
            uf: uf,
            city: city,
            cnae: cnae,
            period: query.period ?? "current_month",
            month: query.month ?? new Date().getMonth() + 1,
            year: query.year ?? new Date().getFullYear(),
            assignedToId: query.assignedToId ?? "Todos",
          }}
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
                to="/funil-comercial"
                search={{
                  search: "",
                  uf: uf,
                  city: city,
                  cnae: cnae,
                  period: query.period ?? "current_month",
                  month: query.month ?? new Date().getMonth() + 1,
                  year: query.year ?? new Date().getFullYear(),
                  assignedToId: query.assignedToId ?? "Todos",
                }}
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
