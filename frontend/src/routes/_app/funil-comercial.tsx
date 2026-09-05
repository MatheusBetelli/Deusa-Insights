import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { formatCnae } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { pipelineService } from "@/services/pipelineService";
import type { Cnae } from "@/types/cnae";
import type { City } from "@/types/city";
import type { DashboardPeriod } from "@/types/dashboard";
import type { Pipeline, PipelineStatus } from "@/types/pipeline";
import { CircleDot, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

const PERIOD_OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: "current_month", label: "Mês atual" },
  { value: "last_3_months", label: "Últimos 3 meses" },
  { value: "last_6_months", label: "Últimos 6 meses" },
  { value: "last_12_months", label: "Últimos 12 meses" },
  { value: "selected_month", label: "Mês específico" },
];

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

const COLUMN_PAGE_SIZE = 6;
const columns: PipelineStatus[] = ["NEW", "CONVERTED"];
const columnConfig = {
  NEW: {
    label: "Novos",
    description: "Oportunidades fora da carteira oficial",
    border: "border-slate-200",
    header: "bg-slate-100/70 border-slate-200",
    body: "bg-slate-50/50",
    icon: "text-slate-600",
    badge: "bg-slate-200 text-slate-700",
  },
  CONVERTED: {
    label: "Clientes confirmados",
    description: "Clientes da carteira oficial da Central Comercial",
    border: "border-emerald-200",
    header: "bg-emerald-50/80 border-emerald-200",
    body: "bg-emerald-50/30",
    icon: "text-emerald-700",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

function CommercialFunnel() {
  const pipelineRequestSequence = useRef(0);
  const stageRequests = useRef(new Set<PipelineStatus>());
  const routeSearch = Route.useSearch();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [search, setSearch] = useState(routeSearch.search);
  const [uf, setUf] = useState(routeSearch.uf);
  const [city, setCity] = useState(routeSearch.city);
  const [cnae, setCnae] = useState(routeSearch.cnae);
  const [period, setPeriod] = useState(routeSearch.period);
  const [month, setMonth] = useState(routeSearch.month);
  const [year, setYear] = useState(routeSearch.year);
  const [assignedToId, setAssignedToId] = useState(routeSearch.assignedToId);
  const [loading, setLoading] = useState(true);
  const [loadingStages, setLoadingStages] = useState<PipelineStatus[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearch(routeSearch.search);
    setUf(routeSearch.uf);
    setCity(routeSearch.city);
    setCnae(routeSearch.cnae);
    setPeriod(routeSearch.period);
    setMonth(routeSearch.month);
    setYear(routeSearch.year);
    setAssignedToId(routeSearch.assignedToId);
  }, [routeSearch]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const [cityData, cnaeData] = await Promise.all([
          citiesService.getCities(),
          cnaesService.getCnaes(),
        ]);
        setCities(cityData);
        setCnaes(cnaeData);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não foi possível carregar filtros.");
      }
    }

    void loadOptions();
  }, []);

  const filters = useMemo(
    () => ({
      search: search.trim() || undefined,
      uf: uf !== "Todos" ? uf : undefined,
      city: city !== "Todas" ? city : undefined,
      cnae: cnae !== "Todos" ? cnae : undefined,
      period,
      month: period === "selected_month" ? month : undefined,
      year: period === "selected_month" ? year : undefined,
      assignedToId: assignedToId !== "Todos" ? assignedToId : undefined,
    }),
    [search, uf, city, cnae, period, month, year, assignedToId],
  );

  const loadPipeline = useCallback(async () => {
    const requestId = ++pipelineRequestSequence.current;
    stageRequests.current.clear();
    setLoading(true);
    setLoadingStages([]);
    setError(null);
    try {
      const nextPipeline = await pipelineService.getPipeline({
        ...filters,
        columnPageSize: COLUMN_PAGE_SIZE,
      });
      if (requestId !== pipelineRequestSequence.current) return;
      setPipeline(nextPipeline);
    } catch (err) {
      if (requestId !== pipelineRequestSequence.current) return;
      setPipeline(null);
      setError(err instanceof Error ? err.message : "Não foi possível carregar o funil.");
    } finally {
      if (requestId === pipelineRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPipeline();
    }, 250);
    return () => {
      window.clearTimeout(timer);
      pipelineRequestSequence.current += 1;
    };
  }, [loadPipeline]);

  async function loadMore(status: PipelineStatus) {
    const stage = pipeline?.stages[status];
    if (loading || !stage || stage.page >= stage.totalPages || stageRequests.current.has(status)) {
      return;
    }

    const requestId = pipelineRequestSequence.current;
    stageRequests.current.add(status);
    setLoadingStages((current) => [...current, status]);
    try {
      const next = await pipelineService.getStage(status, {
        ...filters,
        page: stage.page + 1,
        pageSize: COLUMN_PAGE_SIZE,
      });
      if (requestId !== pipelineRequestSequence.current) return;
      setPipeline((current) => {
        if (!current) return current;
        const previous = current.stages[status];
        return {
          ...current,
          stages: {
            ...current.stages,
            [status]: { ...next, items: [...previous.items, ...next.items] },
          },
        };
      });
    } catch (err) {
      if (requestId !== pipelineRequestSequence.current) return;
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar mais registros.");
    } finally {
      if (requestId === pipelineRequestSequence.current) {
        stageRequests.current.delete(status);
        setLoadingStages((current) => current.filter((item) => item !== status));
      }
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-[#0B1F33]">Funil comercial</h1>
        <p className="mt-1 text-sm leading-relaxed text-[#475569]">
          Clientes confirmados seguem a carteira oficial da Central Comercial. Novos são as
          oportunidades fora dessa carteira. Etapas intermediárias aguardam validação comercial.
        </p>
        <p className="mt-2 text-xs text-[#475569]">
          Compare as telas com o mesmo período e filtros. A classificação acompanha a base oficial.
        </p>
        <Link
          to="/dashboard"
          className="mt-3 inline-flex text-sm font-semibold text-[#1061AF] underline underline-offset-4"
        >
          Abrir Central Comercial
        </Link>
      </section>

      <section
        aria-label="Filtros do funil"
        className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm"
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
              Pesquisa
            </span>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748B]"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Empresa, CNPJ ou cidade"
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
              />
            </div>
          </label>
          <FilterSelect
            label="Estado (UF)"
            value={uf}
            onChange={(newUf) => {
              setUf(newUf);
              setCity("Todas");
            }}
          >
            <option value="Todos">Todos</option>
            {ESTADOS_UF.map((ufOption) => (
              <option key={ufOption} value={ufOption}>
                {ufOption}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Cidade" value={city} onChange={setCity}>
            <option value="Todas">Todas</option>
            {cities
              .filter((item) => uf === "Todos" || item.uf === uf)
              .map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
          </FilterSelect>
          <FilterSelect label="CNAE" value={cnae} onChange={setCnae}>
            <option value="Todos">Todos</option>
            {cnaes.map((item) => (
              <option key={item.id} value={item.code}>
                {formatCnae(item.code)}
              </option>
            ))}
          </FilterSelect>
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
          {period === "selected_month" && (
            <>
              <FilterSelect
                label="Mês"
                value={String(month)}
                onChange={(value) => setMonth(Number(value))}
              >
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {new Date(2026, index, 1).toLocaleDateString("pt-BR", { month: "long" })}
                  </option>
                ))}
              </FilterSelect>
              <label className="block">
                <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
                  Ano
                </span>
                <input
                  type="number"
                  min={2000}
                  max={2100}
                  value={year}
                  onChange={(event) => {
                    const nextYear = Number(event.target.value);
                    if (Number.isInteger(nextYear) && nextYear >= 2000 && nextYear <= 2100)
                      setYear(nextYear);
                  }}
                  className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </label>
            </>
          )}
        </div>
        {assignedToId !== "Todos" && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[#475569]">
            <span>Filtro de responsável da Central Comercial aplicado.</span>
            <button
              type="button"
              onClick={() => setAssignedToId("Todos")}
              className="font-semibold text-[#1061AF] underline underline-offset-4"
            >
              Mostrar todos os responsáveis
            </button>
          </div>
        )}
      </section>

      {error && (
        <ErrorState
          description={error}
          action={
            <button
              onClick={() => void loadPipeline()}
              className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
            >
              Tentar novamente
            </button>
          }
        />
      )}

      {loading ? (
        <LoadingState message="Carregando funil comercial..." />
      ) : !pipeline ? (
        !error && (
          <EmptyState title="Funil indisponível" description="Não há dados do funil para exibir." />
        )
      ) : (
        <>
          <section
            aria-live="polite"
            className="rounded-xl border border-[#DDE5EF] bg-white px-4 py-3 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="font-bold text-[#0B1F33]">
                {pipeline.total.toLocaleString("pt-BR")} registros no funil
              </span>
              <span className="text-[#475569]">Período: {pipeline.period.label}</span>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {columns.map((column) => {
              const stage = pipeline.stages[column];
              const config = columnConfig[column];
              return (
                <section
                  key={column}
                  aria-labelledby={"pipeline-stage-" + column}
                  className={
                    "flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm " +
                    config.border
                  }
                >
                  <div className={"border-b px-4 py-3 " + config.header}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CircleDot aria-hidden="true" className={"h-4 w-4 " + config.icon} />
                          <h2
                            id={"pipeline-stage-" + column}
                            className="text-base font-bold text-[#0B1F33]"
                          >
                            {config.label}
                          </h2>
                        </div>
                        <p className="mt-1 text-xs text-[#475569]">{config.description}</p>
                        <p className="mt-1 text-xs text-[#475569]">
                          {stage.conversionRate}% dos registros
                        </p>
                      </div>
                      <span className={"rounded-full px-3 py-1 text-sm font-bold " + config.badge}>
                        {stage.total.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>

                  <div className={"flex-1 space-y-3 p-3 " + config.body}>
                    <ul className="space-y-3">
                      {stage.items.map((card) => (
                        <li key={card.id}>
                          <article className="rounded-lg border border-[#DDE5EF] bg-white p-4">
                            <h3 className="break-words text-sm font-bold text-[#0B1F33]">
                              {card.companyName}
                            </h3>
                            <p className="mt-1 text-sm text-[#475569]">
                              {card.city || "Cidade não informada"}
                            </p>
                            {card.assignedTo && (
                              <p className="mt-2 text-xs text-[#475569]">
                                Responsável: {card.assignedTo}
                              </p>
                            )}
                          </article>
                        </li>
                      ))}
                    </ul>
                    {stage.items.length === 0 && (
                      <p className="rounded-lg border border-dashed border-[#CBD5E1] bg-white p-5 text-center text-sm text-[#475569]">
                        Nenhum registro para os filtros selecionados.
                      </p>
                    )}
                    {stage.page < stage.totalPages && (
                      <button
                        type="button"
                        onClick={() => void loadMore(column)}
                        disabled={loadingStages.includes(column)}
                        aria-label={"Carregar mais " + config.label.toLowerCase()}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white text-sm font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-60"
                      >
                        {loadingStages.includes(column) && (
                          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                        )}
                        Carregar mais
                      </button>
                    )}
                  </div>
                  <p className="border-t border-[#DDE5EF] px-4 py-3 text-xs text-[#475569]">
                    Exibindo {stage.items.length.toLocaleString("pt-BR")} de{" "}
                    {stage.total.toLocaleString("pt-BR")} registros
                  </p>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
      >
        {children}
      </select>
    </label>
  );
}
