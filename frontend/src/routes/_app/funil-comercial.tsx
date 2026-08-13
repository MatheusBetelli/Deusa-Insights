import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { LeadDetailsSheet } from "@/features/leads/components/LeadDetailsSheet";
import { formatCnae, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { pipelineService } from "@/services/pipelineService";
import type { Cnae } from "@/types/cnae";
import type { City } from "@/types/city";
import type { LeadStatus, PotentialLevel } from "@/types/lead";
import type { Pipeline } from "@/types/pipeline";
import { ArrowRight, CircleDot, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/funil-comercial")({
  validateSearch: (search) => ({
    search: typeof search.search === "string" ? search.search : "",
    uf: typeof search.uf === "string" ? search.uf : "Todos",
    city: typeof search.city === "string" ? search.city : "Todas",
    cnae: typeof search.cnae === "string" ? search.cnae : "Todos",
  }),
  component: CommercialFunnel,
});

const columns: LeadStatus[] = ["NEW", "CONTACTED", "INTERESTED", "NEGOTIATION", "CONVERTED"];
const COLUMN_PAGE_SIZE = 6;

function priorityClass(priority: PotentialLevel) {
  if (priority === "CRITICAL") return "border-[#ED1C24]/30 bg-[#ED1C24]/10 text-[#B91C1C]";
  if (priority === "HIGH") return "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]";
  if (priority === "MEDIUM") return "border-[#1061AF]/30 bg-blue-50 text-[#1061AF]";
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#64748B]";
}

function CommercialFunnel() {
  const routeSearch = Route.useSearch();
  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [search, setSearch] = useState(routeSearch.search);
  const [uf, setUf] = useState(routeSearch.uf);
  const [city, setCity] = useState(routeSearch.city);
  const [cnae, setCnae] = useState(routeSearch.cnae);
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<LeadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    setSearch(routeSearch.search);
    setUf(routeSearch.uf);
    setCity(routeSearch.city);
    setCnae(routeSearch.cnae);
  }, [routeSearch.search, routeSearch.uf, routeSearch.city, routeSearch.cnae]);

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
    }),
    [search, uf, city, cnae],
  );

  const loadPipeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPipeline(
        await pipelineService.getPipeline({ ...filters, columnPageSize: COLUMN_PAGE_SIZE }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o funil.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPipeline();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [loadPipeline]);

  async function loadMore(status: LeadStatus) {
    const stage = pipeline?.stages[status];
    if (!stage || stage.page >= stage.totalPages) return;

    setLoadingStage(status);
    try {
      const next = await pipelineService.getStage(status, {
        ...filters,
        page: stage.page + 1,
        pageSize: COLUMN_PAGE_SIZE,
      });
      setPipeline((current) => {
        if (!current) return current;
        const previous = current.stages[status];
        return {
          ...current,
          stages: {
            ...current.stages,
            [status]: {
              ...next,
              items: [...(previous?.items ?? []), ...next.items],
            },
          },
        };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar mais leads.");
    } finally {
      setLoadingStage(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
            Comercial
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">
            Funil Comercial
          </h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Acompanhe e avance oportunidades B2B desde a prospecção até a conversão.
          </p>
        </div>
      </div>

      <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
              Pesquisa
            </span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
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
              .filter(c => uf === "Todos" || c.uf === uf)
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
        </div>
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
        <EmptyState
          title="Funil indisponível"
          description="Não há dados de pipeline para exibir."
        />
      ) : (
        <>
          <section className="rounded-xl border border-[#DDE5EF] bg-white px-4 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-medium">
              <span className="font-bold text-[#0B1F33]">{pipeline.total} leads no funil</span>
              <span className="text-[#64748B] font-medium">
                Visão operacional do funil comercial · Oportunidades ordenadas por prioridade
              </span>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-5">
            {columns.map((column) => {
              const stage = pipeline.stages[column];
              const items = stage?.items ?? [];
              return (
                <div
                  key={column}
                  className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm"
                >
                  <div className="border-b border-[#DDE5EF] px-3 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CircleDot className="h-3.5 w-3.5 text-[#1061AF]" />
                          <h2 className="truncate text-sm font-bold text-[#0B1F33]">
                            {statusLabels[column]}
                          </h2>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-[#94A3B8]">
                          {stage?.conversionRate ?? 0}% do funil
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1F5F9] px-2 py-1 text-xs font-bold text-[#0B1F33]">
                        {stage?.total ?? 0}
                      </span>
                    </div>
                  </div>

                  <div className="max-h-[520px] min-h-[360px] space-y-2 overflow-y-auto bg-[#F8FAFC] p-2.5">
                    {items.map((lead) => (
                      <Link
                        key={lead.id}
                        to="/leads-b2b/$leadId"
                        params={{ leadId: lead.id }}
                        className="block w-full rounded-lg border border-[#DDE5EF] bg-white p-3 text-left shadow-sm transition hover:border-[#1061AF]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold leading-snug text-[#0B1F33]">
                              {lead.companyName}
                            </h3>
                            <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                              {lead.city}
                            </p>
                          </div>
                          <span className="rounded-md border border-[#DDE5EF] bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-[#0B1F33]">
                            {lead.score}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityClass(lead.potentialLevel)}`}>
                            {potentialLabels[lead.potentialLevel]}
                          </span>
                          {lead.assignedTo ? (
                            <span className="truncate text-[11px] font-medium text-[#64748B]">
                              {lead.assignedTo}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                              Sem responsável
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}

                    {items.length === 0 && (
                      <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white p-4 text-center text-xs font-medium text-[#94A3B8]">
                        Nenhum lead nesta etapa.
                      </div>
                    )}

                    {stage && stage.page < stage.totalPages && (
                      <button
                        onClick={() => void loadMore(column)}
                        disabled={loadingStage === column}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-60"
                      >
                        {loadingStage === column && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        )}
                        Carregar mais
                      </button>
                    )}
                  </div>

                  {stage && stage.total > 0 && (
                    <div className="border-t border-[#DDE5EF] p-2.5">
                      <Link
                        to="/leads-b2b"
                        search={{ status: column, uf, city, cnae, search }}
                        className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
                      >
                        Ver todos
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        </>
      )}

      <LeadDetailsSheet
        leadId={selectedLeadId}
        open={!!selectedLeadId}
        onOpenChange={(open) => {
          if (!open) setSelectedLeadId(null);
        }}
        onUpdated={() => void loadPipeline()}
      />
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
