import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { LeadDetailsSheet } from "@/features/leads/components/LeadDetailsSheet";
import { formatCnae, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { pipelineService } from "@/services/pipelineService";
import { leadsService } from "@/services/leadsService";
import type { Cnae } from "@/types/cnae";
import type { City } from "@/types/city";
import type { LeadStatus, PotentialLevel } from "@/types/lead";
import type { Pipeline, PipelineCard } from "@/types/pipeline";
import { ArrowRight, CircleDot, ExternalLink, GripVertical, Loader2, Search } from "lucide-react";
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

const columnStyles: Partial<
  Record<
    LeadStatus,
    {
      border: string;
      bgHeader: string;
      bgBody: string;
      iconColor: string;
      badgeBg: string;
      badgeText: string;
    }
  >
> = {
  NEW: {
    border: "border-slate-200",
    bgHeader: "bg-slate-100/70 border-slate-200/80",
    bgBody: "bg-slate-50/50",
    iconColor: "text-slate-600",
    badgeBg: "bg-slate-200/80",
    badgeText: "text-slate-700",
  },
  CONTACTED: {
    border: "border-sky-200/80",
    bgHeader: "bg-sky-50/80 border-sky-200/60",
    bgBody: "bg-sky-50/30",
    iconColor: "text-sky-600",
    badgeBg: "bg-sky-100",
    badgeText: "text-sky-800",
  },
  INTERESTED: {
    border: "border-indigo-200/80",
    bgHeader: "bg-indigo-50/80 border-indigo-200/60",
    bgBody: "bg-indigo-50/30",
    iconColor: "text-indigo-600",
    badgeBg: "bg-indigo-100",
    badgeText: "text-indigo-800",
  },
  NEGOTIATION: {
    border: "border-amber-200/80",
    bgHeader: "bg-amber-50/80 border-amber-200/60",
    bgBody: "bg-amber-50/30",
    iconColor: "text-amber-600",
    badgeBg: "bg-amber-100",
    badgeText: "text-amber-800",
  },
  CONVERTED: {
    border: "border-emerald-200/80",
    bgHeader: "bg-emerald-50/80 border-emerald-200/60",
    bgBody: "bg-emerald-50/30",
    iconColor: "text-emerald-600",
    badgeBg: "bg-emerald-100",
    badgeText: "text-emerald-800",
  },
};

function priorityClass(priority: PotentialLevel) {
  if (priority === "CRITICAL") return "border-[#ED1C24]/30 bg-[#ED1C24]/10 text-[#B91C1C]";
  if (priority === "HIGH") return "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]";
  if (priority === "MEDIUM") return "border-[#1061AF]/30 bg-blue-50 text-[#1061AF]";
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#64748B]";
}

function CommercialFunnel() {
  const pipelineRequestSequence = useRef(0);
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

  // Drag and drop state
  const [draggedLead, setDraggedLead] = useState<{
    id: string;
    sourceStatus: LeadStatus;
    companyName: string;
  } | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<LeadStatus | null>(null);

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
    const requestId = ++pipelineRequestSequence.current;
    setLoading(true);
    setLoadingStage(null);
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

  async function loadMore(status: LeadStatus) {
    const stage = pipeline?.stages[status];
    if (!stage || stage.page >= stage.totalPages) return;

    const requestId = pipelineRequestSequence.current;
    setLoadingStage(status);
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
            [status]: {
              ...next,
              items: [...(previous?.items ?? []), ...next.items],
            },
          },
        };
      });
    } catch (err) {
      if (requestId !== pipelineRequestSequence.current) return;
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar mais leads.");
    } finally {
      if (requestId === pipelineRequestSequence.current) {
        setLoadingStage(null);
      }
    }
  }

  // Handlers para Drag and Drop de cards no Kanban
  const handleDragStart = (e: React.DragEvent, lead: PipelineCard, sourceStatus: LeadStatus) => {
    e.dataTransfer.setData("text/plain", lead.id);
    e.dataTransfer.effectAllowed = "move";
    setDraggedLead({ id: lead.id, sourceStatus, companyName: lead.companyName });
  };

  const handleDragEnd = () => {
    setDraggedLead(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, column: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== column) {
      setDragOverColumn(column);
    }
  };

  const handleDragLeave = (e: React.DragEvent, column: LeadStatus) => {
    e.preventDefault();
    const currentTarget = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {
      return;
    }
    if (dragOverColumn === column) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedLead) return;
    const { id: leadId, sourceStatus, companyName: name } = draggedLead;

    if (sourceStatus === targetStatus) {
      setDraggedLead(null);
      return;
    }

    // Atualização otimista no estado do pipeline
    setPipeline((current) => {
      if (!current) return current;

      const sourceStage = current.stages[sourceStatus];
      const targetStage = current.stages[targetStatus];
      const cardToMove = sourceStage?.items.find((item) => item.id === leadId);

      if (!cardToMove) return current;

      const updatedCard = { ...cardToMove, status: targetStatus };

      const newSourceItems = sourceStage?.items.filter((item) => item.id !== leadId) ?? [];
      const newTargetItems = [updatedCard, ...(targetStage?.items ?? [])];

      const newSourceTotal = Math.max(0, (sourceStage?.total ?? 1) - 1);
      const newTargetTotal = (targetStage?.total ?? 0) + 1;

      return {
        ...current,
        stages: {
          ...current.stages,
          [sourceStatus]: sourceStage
            ? { ...sourceStage, total: newSourceTotal, items: newSourceItems }
            : undefined,
          [targetStatus]: targetStage
            ? { ...targetStage, total: newTargetTotal, items: newTargetItems }
            : {
                status: targetStatus,
                total: 1,
                page: 1,
                pageSize: COLUMN_PAGE_SIZE,
                totalPages: 1,
                conversionRate: 0,
                items: [updatedCard],
              },
        },
      };
    });

    toast.success(`"${name}" movido para ${statusLabels[targetStatus]}`);

    try {
      await leadsService.updateLead(leadId, { status: targetStatus });
      void loadPipeline();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível mover o lead.");
      void loadPipeline();
    } finally {
      setDraggedLead(null);
    }
  };

  return (
    <div className="space-y-5">
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
              .filter((c) => uf === "Todos" || c.uf === uf)
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
                Visão operacional do funil comercial · Arraste os cards entre colunas para alterar o
                status
              </span>
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-5">
            {columns.map((column) => {
              const stage = pipeline.stages[column];
              const items = stage?.items ?? [];
              const isOver = dragOverColumn === column;
              const style = columnStyles[column] ?? columnStyles.NEW!;

              return (
                <div
                  key={column}
                  onDragOver={(e) => handleDragOver(e, column)}
                  onDragLeave={(e) => handleDragLeave(e, column)}
                  onDrop={(e) => void handleDrop(e, column)}
                  className={`flex flex-col overflow-hidden rounded-xl border transition-all duration-150 ${
                    isOver
                      ? "border-2 border-dashed border-[#1061AF] bg-[#EFF6FF] shadow-lg ring-2 ring-[#1061AF]/20"
                      : `${style.border} bg-white shadow-sm`
                  }`}
                >
                  <div
                    className={`border-b px-3 py-3 transition-colors ${
                      isOver ? "border-[#1061AF]/30 bg-[#DBEAFE]" : style.bgHeader
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CircleDot className={`h-3.5 w-3.5 ${style.iconColor}`} />
                          <h2 className="truncate text-sm font-bold text-[#0B1F33]">
                            {statusLabels[column]}
                          </h2>
                        </div>
                        <p className="mt-1 text-[11px] font-semibold text-[#64748B]">
                          {stage?.conversionRate ?? 0}% do funil
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${style.badgeBg} ${style.badgeText}`}
                      >
                        {stage?.total ?? 0}
                      </span>
                    </div>
                  </div>

                  <div
                    className={`flex-1 max-h-[520px] min-h-[360px] space-y-2 overflow-y-auto p-2.5 transition-colors ${
                      isOver ? "bg-[#EFF6FF]" : style.bgBody
                    }`}
                  >
                    {isOver && (
                      <div className="mb-2 rounded-lg border-2 border-dashed border-[#1061AF] bg-white p-2.5 text-center text-xs font-bold text-[#1061AF] animate-pulse">
                        Mover lead para "{statusLabels[column]}"
                      </div>
                    )}

                    {items.map((lead) => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead, column)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedLeadId(lead.id)}
                        className={`group relative w-full cursor-grab active:cursor-grabbing rounded-lg border bg-white p-3 text-left shadow-2xs transition-all hover:border-[#1061AF] hover:shadow-md ${
                          draggedLead?.id === lead.id
                            ? "opacity-40 scale-95 border-dashed border-[#1061AF]"
                            : "border-[#DDE5EF]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <h3 className="truncate text-sm font-bold leading-snug text-[#0B1F33] group-hover:text-[#1061AF]">
                                {lead.companyName}
                              </h3>
                              <GripVertical className="h-3.5 w-3.5 shrink-0 text-[#CBD5E1] opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="mt-0.5 text-[11px] font-semibold text-[#64748B]">
                              {lead.city}
                            </p>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between gap-2">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${priorityClass(lead.potentialLevel)}`}
                          >
                            {potentialLabels[lead.potentialLevel]}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Link
                              to="/leads-b2b"
                              search={{ search: lead.companyName }}
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[10px] font-semibold text-[#1061AF] hover:bg-[#E2E8F0] transition"
                              title={`Abrir apenas "${lead.companyName}" na lista de Leads B2B`}
                            >
                              <ExternalLink className="h-2.5 w-2.5" />
                              <span>Ver no B2B</span>
                            </Link>
                            {lead.assignedTo && (
                              <span className="truncate text-[11px] font-medium text-[#64748B]">
                                {lead.assignedTo}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {items.length === 0 && !isOver && (
                      <div className="flex min-h-[140px] items-center justify-center rounded-lg border border-dashed border-[#CBD5E1] bg-white p-4 text-center text-xs font-medium text-[#94A3B8]">
                        Nenhum lead nesta etapa.
                      </div>
                    )}

                    {stage && stage.page < stage.totalPages && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void loadMore(column);
                        }}
                        disabled={loadingStage === column}
                        className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-60 cursor-pointer"
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
