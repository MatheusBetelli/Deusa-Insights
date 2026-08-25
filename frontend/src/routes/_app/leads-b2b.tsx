import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { LeadDetailsSheet } from "@/features/leads/components/LeadDetailsSheet";
import { LeadContactsPopover } from "@/features/leads/components/LeadContactsPopover";
import { PaginationBar } from "@/components/common/PaginationBar";
import { ScoreBreakdownTooltip } from "@/components/common/ScoreBreakdownTooltip";
import {
  companyName,
  formatCnae,
  formatCnpj,
  formatDateTime,
  potentialLabels,
  statusLabels,
} from "@/lib/commercial-formatters";
import { ESTADOS_UF } from "@/lib/constants";
import { AuthService } from "@/lib/auth";
import { citiesService } from "@/services/citiesService";
import { cnaesService } from "@/services/cnaesService";
import { leadsService } from "@/services/leadsService";
import type { Cnae } from "@/types/cnae";
import type { City } from "@/types/city";
import type { Lead, LeadQuery, LeadStatus, PotentialLevel } from "@/types/lead";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  Download,
  EllipsisVertical,
  Eye,
  Loader2,
  MapPin,
  PhoneCall,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type LeadsB2BSearch = {
  search?: string;
  uf?: string;
  city?: string;
  cnae?: string;
  status?: string;
  potentialLevel?: string;
  statusVerificacaoEndereco?: string;
  pendenteValidacao?: string;
  situacaoCadastral?: string;
  sortBy?: string;
  sortOrder?: string;
  page?: number;
};

const B2B_STORAGE_KEY = "deusa_b2b_filters";

function getStoredB2BFilters(): LeadsB2BSearch {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(B2B_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function setStoredB2BFilters(filters: LeadsB2BSearch) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(B2B_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
}

export const Route = createFileRoute("/_app/leads-b2b")({
  validateSearch: (search: Record<string, unknown>): LeadsB2BSearch => ({
    search: typeof search.search === "string" ? search.search : undefined,
    uf: typeof search.uf === "string" ? search.uf : undefined,
    city: typeof search.city === "string" ? search.city : undefined,
    cnae: typeof search.cnae === "string" ? search.cnae : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    potentialLevel: typeof search.potentialLevel === "string" ? search.potentialLevel : undefined,
    statusVerificacaoEndereco:
      typeof search.statusVerificacaoEndereco === "string"
        ? search.statusVerificacaoEndereco
        : undefined,
    pendenteValidacao:
      typeof search.pendenteValidacao === "string" ? search.pendenteValidacao : undefined,
    situacaoCadastral:
      typeof search.situacaoCadastral === "string" ? search.situacaoCadastral : undefined,
    sortBy: typeof search.sortBy === "string" ? search.sortBy : undefined,
    sortOrder:
      search.sortOrder === "asc" || search.sortOrder === "desc" ? search.sortOrder : undefined,
    page:
      typeof search.page === "number"
        ? search.page
        : typeof search.page === "string"
          ? parseInt(search.page, 10) || 1
          : undefined,
  }),
  component: LeadsB2B,
});

const PAGE_SIZE = 25;

type SortBy = NonNullable<LeadQuery["sortBy"]>;

function priorityClass(priority: PotentialLevel) {
  if (priority === "CRITICAL") return "border-[#ED1C24]/40 bg-[#ED1C24]/10 text-[#B91C1C]";
  if (priority === "HIGH") return "border-[#F97316]/40 bg-[#FFF7ED] text-[#C2410C]";
  if (priority === "MEDIUM") return "border-[#1061AF]/30 bg-blue-50 text-[#1061AF]";
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#64748B]";
}

function statusBadgeStyle(status: LeadStatus) {
  if (status === "CONVERTED") return "border-emerald-300 bg-emerald-50 text-emerald-800 font-bold";
  if (status === "INTERESTED") return "border-blue-300 bg-blue-50 text-blue-800 font-semibold";
  if (status === "NEGOTIATION") return "border-amber-300 bg-amber-50 text-amber-800 font-semibold";
  if (status === "CONTACTED") return "border-slate-300 bg-slate-100 text-slate-800 font-medium";
  if (status === "NOT_INTERESTED") return "border-red-200 bg-red-50 text-red-700 font-medium";
  if (status === "INACTIVE")
    return "border-slate-300 bg-slate-100 text-slate-500 font-medium line-through";
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#475569] font-medium";
}

function LeadsB2B() {
  const routeSearch = Route.useSearch();
  const navigate = Route.useNavigate();
  const storedFilters = useMemo(() => getStoredB2BFilters(), []);

  const currentUser = AuthService.getUser();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialSearch = routeSearch.search ?? storedFilters.search ?? "";
  const initialUf = routeSearch.uf ?? storedFilters.uf ?? "Todos";
  const initialCity = routeSearch.city ?? storedFilters.city ?? "Todas";
  const initialCnae = routeSearch.cnae ?? storedFilters.cnae ?? "Todos";
  const initialStatus = routeSearch.status ?? storedFilters.status ?? "Todos";
  const initialPotentialLevel =
    routeSearch.potentialLevel ?? storedFilters.potentialLevel ?? "Todos";
  const initialStatusVerificacao =
    routeSearch.statusVerificacaoEndereco ?? storedFilters.statusVerificacaoEndereco ?? "Todos";
  const initialPendenteValidacao =
    routeSearch.pendenteValidacao ?? storedFilters.pendenteValidacao ?? "Todos";
  const initialSituacaoCadastral =
    routeSearch.situacaoCadastral ?? storedFilters.situacaoCadastral ?? "ATIVA";
  const initialSortBy =
    (routeSearch.sortBy as SortBy) ?? (storedFilters.sortBy as SortBy) ?? "score";
  const initialSortOrder =
    (routeSearch.sortOrder as "asc" | "desc") ??
    (storedFilters.sortOrder as "asc" | "desc") ??
    "desc";
  const initialPage = routeSearch.page ?? storedFilters.page ?? 1;

  const [query, setQuery] = useState(initialSearch);
  const [uf, setUf] = useState(initialUf);
  const [city, setCity] = useState(initialCity);
  const [cnae, setCnae] = useState(initialCnae);
  const [status, setStatus] = useState(initialStatus);
  const [potentialLevel, setPotentialLevel] = useState(initialPotentialLevel);
  const [statusVerificacaoEndereco, setStatusVerificacaoEndereco] =
    useState(initialStatusVerificacao);
  const [pendenteValidacao, setPendenteValidacao] = useState(initialPendenteValidacao);
  const [situacaoCadastral, setSituacaoCadastral] = useState(initialSituacaoCadastral);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(initialSortOrder);
  const [page, setPage] = useState(initialPage);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [highPotentialCount, setHighPotentialCount] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const loadSequence = useRef(0);

  useEffect(() => {
    const currentParams: LeadsB2BSearch = {
      search: query.trim() || undefined,
      uf: uf !== "Todos" ? uf : undefined,
      city: city !== "Todas" ? city : undefined,
      cnae: cnae !== "Todos" ? cnae : undefined,
      status: status !== "Todos" ? status : undefined,
      potentialLevel: potentialLevel !== "Todos" ? potentialLevel : undefined,
      statusVerificacaoEndereco:
        statusVerificacaoEndereco !== "Todos" ? statusVerificacaoEndereco : undefined,
      pendenteValidacao: pendenteValidacao !== "Todos" ? pendenteValidacao : undefined,
      situacaoCadastral: situacaoCadastral !== "ATIVA" ? situacaoCadastral : undefined,
      sortBy: sortBy !== "score" ? sortBy : undefined,
      sortOrder: sortOrder !== "desc" ? sortOrder : undefined,
      page: page > 1 ? page : undefined,
    };
    setStoredB2BFilters(currentParams);
    void navigate({ search: currentParams, replace: true });
  }, [
    query,
    uf,
    city,
    cnae,
    status,
    potentialLevel,
    statusVerificacaoEndereco,
    pendenteValidacao,
    situacaoCadastral,
    sortBy,
    sortOrder,
    page,
    navigate,
  ]);

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
      toast.error(err instanceof Error ? err.message : "Não foi possível carregar filtros.");
    } finally {
      setOptionsLoading(false);
    }
  }

  useEffect(() => {
    void loadOptions();
  }, []);

  const baseFilters = useMemo<LeadQuery>(() => {
    const filters: LeadQuery = {};
    if (query.trim()) filters.search = query.trim();
    if (uf !== "Todos") filters.uf = uf;
    if (city !== "Todas") filters.city = city;
    if (cnae !== "Todos") filters.cnae = cnae;
    if (status !== "Todos") filters.status = status as LeadStatus;
    if (potentialLevel !== "Todos") filters.potentialLevel = potentialLevel as PotentialLevel;
    if (statusVerificacaoEndereco !== "Todos")
      filters.statusVerificacaoEndereco = statusVerificacaoEndereco;
    if (pendenteValidacao !== "Todos") filters.pendenteValidacao = pendenteValidacao;
    if (situacaoCadastral !== "Todos") filters.situacaoCadastral = situacaoCadastral;
    return filters;
  }, [
    query,
    uf,
    city,
    cnae,
    status,
    potentialLevel,
    statusVerificacaoEndereco,
    pendenteValidacao,
    situacaoCadastral,
  ]);

  const countPriorityLeads = useCallback(async (filters: LeadQuery) => {
    if (filters.potentialLevel && !["HIGH", "CRITICAL"].includes(filters.potentialLevel)) return 0;
    const withoutPotential = { ...filters };
    delete withoutPotential.potentialLevel;
    const [high, critical] = await Promise.all([
      leadsService.getLeadsPage({
        ...withoutPotential,
        potentialLevel: "HIGH",
        page: 1,
        pageSize: 1,
      }),
      leadsService.getLeadsPage({
        ...withoutPotential,
        potentialLevel: "CRITICAL",
        page: 1,
        pageSize: 1,
      }),
    ]);
    return high.total + critical.total;
  }, []);

  const loadLeads = useCallback(async () => {
    const requestId = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const [data, highCount] = await Promise.all([
        leadsService.getLeadsPage({
          ...baseFilters,
          page,
          pageSize: PAGE_SIZE,
          sortBy,
          sortOrder,
        }),
        countPriorityLeads(baseFilters),
      ]);
      if (requestId !== loadSequence.current) return;
      setLeads(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
      setHighPotentialCount(highCount);
    } catch (err) {
      if (requestId !== loadSequence.current) return;
      setError(err instanceof Error ? err.message : "Não foi possível carregar leads.");
    } finally {
      if (requestId === loadSequence.current) setLoading(false);
    }
  }, [baseFilters, countPriorityLeads, page, sortBy, sortOrder]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadLeads();
    }, 250);
    return () => window.clearTimeout(timer);
  }, [baseFilters, loadLeads, page, sortBy, sortOrder]);

  useEffect(() => {
    setPage(1);
  }, [baseFilters, sortBy, sortOrder]);

  function toggleSort(nextSortBy: SortBy) {
    if (sortBy === nextSortBy) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(nextSortBy);
    setSortOrder(nextSortBy === "company" || nextSortBy === "city" ? "asc" : "desc");
  }

  function clearFilters() {
    setQuery("");
    setUf("Todos");
    setCity("Todas");
    setCnae("Todos");
    setStatus("Todos");
    setPotentialLevel("Todos");
    setStatusVerificacaoEndereco("Todos");
    setPendenteValidacao("Todos");
    setSituacaoCadastral("Todos");
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const csv = await leadsService.exportCsv({ ...baseFilters, sortBy, sortOrder });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "leads-b2b.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com os filtros atuais.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível exportar CSV.");
    } finally {
      setExporting(false);
    }
  }

  async function quickUpdateStatus(lead: Lead, nextStatus: LeadStatus) {
    try {
      await leadsService.updateLead(lead.id, { status: nextStatus });
      toast.success(
        `Status de "${companyName(lead.company)}" atualizado para ${statusLabels[nextStatus]}.`,
      );
      await loadLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o lead.");
    }
  }

  async function quickContact(lead: Lead) {
    try {
      const activeUserId = currentUser?.id || lead.assignedToId || "admin";
      await leadsService.createInteraction(lead.id, {
        userId: activeUserId,
        type: "Contato comercial",
        description: "Contato registrado via painel Leads B2B.",
      });
      toast.success("Contato registrado com sucesso.");
      await loadLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar contato.");
    }
  }

  const activeFilters = [
    query.trim() ? { label: "Busca", value: query.trim(), clear: () => setQuery("") } : null,
    uf !== "Todos" ? { label: "Estado", value: uf, clear: () => setUf("Todos") } : null,
    city !== "Todas" ? { label: "Cidade", value: city, clear: () => setCity("Todas") } : null,
    cnae !== "Todos"
      ? { label: "CNAE", value: formatCnae(cnae), clear: () => setCnae("Todos") }
      : null,
    potentialLevel !== "Todos"
      ? {
          label: "Oportunidade",
          value: potentialLabels[potentialLevel as PotentialLevel],
          clear: () => setPotentialLevel("Todos"),
        }
      : null,
    status !== "Todos"
      ? {
          label: "Status",
          value: statusLabels[status as LeadStatus],
          clear: () => setStatus("Todos"),
        }
      : null,
    statusVerificacaoEndereco !== "Todos"
      ? {
          label: "Endereço",
          value: statusVerificacaoEndereco,
          clear: () => setStatusVerificacaoEndereco("Todos"),
        }
      : null,
    pendenteValidacao !== "Todos"
      ? {
          label: "Validação",
          value: pendenteValidacao === "true" ? "Pendente" : "Sem pendência",
          clear: () => setPendenteValidacao("Todos"),
        }
      : null,
    situacaoCadastral !== "Todos"
      ? { label: "Situação", value: situacaoCadastral, clear: () => setSituacaoCadastral("Todos") }
      : null,
  ].filter(Boolean) as { label: string; value: string; clear: () => void }[];

  return (
    <TooltipProvider>
      <div className="space-y-5 text-[#0B1F33]">
        {/* Header da Tela */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => void handleExportCsv()}
            disabled={exporting}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-sm font-semibold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF] disabled:opacity-60 cursor-pointer shadow-2xs"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#1061AF]" />
            ) : (
              <Download className="h-4 w-4 text-[#1061AF]" />
            )}
            Exportar CSV
          </button>
        </div>

        {/* Métricas Principais */}
        <section className="grid gap-3 sm:grid-cols-2">
          <MetricCard
            label="Total de leads filtrados"
            value={total}
            description="Estabelecimentos no resultado atual"
            accent="#1061AF"
          />
          <MetricCard
            label="Oportunidades de alta prioridade"
            value={highPotentialCount}
            description="Prioridade Alta ou Crítica (Score ≥ 65)"
            accent="#ED1C24"
          />
        </section>

        {/* Filtros e Busca */}
        <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">
                Busca
              </span>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Empresa, CNPJ ou cidade..."
                  className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white"
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
                .map((option) => (
                  <option key={option.id} value={option.name}>
                    {option.name}
                  </option>
                ))}
            </FilterSelect>

            <FilterSelect label="Segmento / CNAE" value={cnae} onChange={setCnae}>
              <option value="Todos">Todos os CNAEs</option>
              {cnaes.map((option) => (
                <option key={option.id} value={option.code}>
                  {formatCnae(option.code)}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect label="Prioridade" value={potentialLevel} onChange={setPotentialLevel}>
              <option value="Todos">Todas as prioridades</option>
              {Object.entries(potentialLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FilterSelect>

            <FilterSelect label="Status Comercial" value={status} onChange={setStatus}>
              <option value="Todos">Todos os status</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </FilterSelect>
          </div>

          <div className="mt-3 border-t border-[#EEF2F7] pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen((current) => !current)}
              className="inline-flex h-8 items-center gap-2 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-semibold text-[#0B1F33] transition hover:border-[#1061AF] cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-[#1061AF]" />
              Filtros avançados
            </button>

            {advancedOpen && (
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                <FilterSelect
                  label="Verificação de Endereço"
                  value={statusVerificacaoEndereco}
                  onChange={setStatusVerificacaoEndereco}
                  compact
                >
                  <option value="Todos">Todos os status de endereço</option>
                  <option value="confiavel_cadastralmente">Confiável cadastralmente</option>
                  <option value="aproximado">Aproximado (GPS)</option>
                  <option value="nao_verificado">Não verificado</option>
                  <option value="verificado">Verificado</option>
                  <option value="divergente">Divergente</option>
                </FilterSelect>
                <FilterSelect
                  label="Validação Cadastral"
                  value={pendenteValidacao}
                  onChange={setPendenteValidacao}
                  compact
                >
                  <option value="Todos">Qualquer estado</option>
                  <option value="true">Apenas pendentes de validação</option>
                  <option value="false">Sem pendência</option>
                </FilterSelect>
                <FilterSelect
                  label="Situação Cadastral"
                  value={situacaoCadastral}
                  onChange={setSituacaoCadastral}
                  compact
                >
                  <option value="Todos">Todas as situações</option>
                  <option value="ATIVA">ATIVA</option>
                  <option value="BAIXADA">BAIXADA</option>
                  <option value="INAPTA">INAPTA</option>
                  <option value="SUSPENSA">SUSPENSA</option>
                  <option value="NULA">NULA</option>
                </FilterSelect>
              </div>
            )}

            {/* Chips de filtros ativos */}
            <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase text-[#64748B]">
                  Filtros aplicados
                </span>
                {activeFilters.length === 0 ? (
                  <span className="text-xs text-[#94A3B8]">Nenhum filtro ativo</span>
                ) : (
                  activeFilters.map((filter) => (
                    <button
                      key={`${filter.label}-${filter.value}`}
                      type="button"
                      onClick={filter.clear}
                      className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#DDE5EF] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] transition hover:border-[#1061AF] hover:text-[#0B1F33] cursor-pointer"
                    >
                      <span className="truncate">
                        {filter.label}: {filter.value}
                      </span>
                      <X className="h-3 w-3 shrink-0 text-[#64748B]" />
                    </button>
                  ))
                )}
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="h-8 shrink-0 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-semibold text-[#0B1F33] transition hover:border-[#1061AF] cursor-pointer"
              >
                Limpar tudo
              </button>
            </div>
          </div>
        </section>

        {/* Tabela de Leads */}
        {error && (
          <ErrorState
            description={error}
            action={
              <button
                onClick={() => void loadLeads()}
                className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-semibold text-white cursor-pointer"
              >
                Tentar novamente
              </button>
            }
          />
        )}

        {loading || optionsLoading ? (
          <LoadingState message="Carregando lista de leads B2B..." />
        ) : leads.length === 0 ? (
          <EmptyState
            title="Nenhum lead encontrado"
            description="Ajuste os filtros de busca para encontrar estabelecimentos cadastrados."
          />
        ) : (
          <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-2xs">
            <div className="max-h-[68vh] overflow-auto">
              <table className="w-full min-w-[1000px] text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-[#DDE5EF] bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B] shadow-[0_1px_0_0_#DDE5EF]">
                  <tr>
                    <th className="px-4 py-3">
                      <SortButton
                        active={sortBy === "company"}
                        order={sortOrder}
                        onClick={() => toggleSort("company")}
                      >
                        Empresa
                      </SortButton>
                    </th>
                    <th className="px-4 py-3">
                      <SortButton
                        active={sortBy === "city"}
                        order={sortOrder}
                        onClick={() => toggleSort("city")}
                      >
                        Localização / CNAE
                      </SortButton>
                    </th>
                    <th className="px-4 py-3">Status comercial</th>
                    <th className="px-4 py-3">
                      <SortButton
                        active={sortBy === "potential" || sortBy === "score"}
                        order={sortOrder}
                        onClick={() => toggleSort("score")}
                      >
                        Prioridade & Score
                      </SortButton>
                    </th>
                    <th className="px-4 py-3">Contatos</th>
                    <th className="px-4 py-3 text-center">Mapa</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF2F7]">
                  {leads.map((lead) => {
                    const leadName = companyName(lead.company);
                    const isCadastralPending =
                      lead.company.pendenteValidacao ||
                      lead.company.statusVerificacaoEndereco === "divergente";
                    const pendingReason = lead.company.pendenteValidacao
                      ? "Validação cadastral pendente"
                      : lead.company.statusVerificacaoEndereco === "divergente"
                        ? "Endereço com divergência no mapa"
                        : "Inconsistência cadastral";

                    return (
                      <tr key={lead.id} className="transition-colors hover:bg-[#F8FAFC]">
                        {/* 1. Empresa (Nome + CNPJ discreto abaixo + Alerta condicional com tooltip) */}
                        <td className="px-4 py-3">
                          <div className="flex min-w-0 flex-col text-left">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <button
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="truncate text-left font-bold leading-snug text-[#0B1F33] hover:text-[#1061AF] cursor-pointer"
                                title={leadName}
                              >
                                {leadName}
                              </button>
                              {isCadastralPending && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="inline-flex shrink-0 cursor-help">
                                      <AlertTriangle className="h-3.5 w-3.5 text-[#ED1C24]" />
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    className="bg-[#0B1F33] text-white text-xs"
                                  >
                                    {pendingReason}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-[#64748B] mt-0.5">
                              {formatCnpj(lead.company.cnpj)}
                            </div>
                          </div>
                        </td>

                        {/* 2. Localização (Cidade/UF + CNAE secundário abaixo) */}
                        <td className="px-4 py-3">
                          <div className="font-semibold leading-snug text-[#0B1F33]">
                            {lead.company.cidade}/{lead.company.uf}
                          </div>
                          <div
                            className="max-w-[220px] truncate text-[11px] text-[#64748B] mt-0.5"
                            title={formatCnae(lead.company.cnaePrincipal)}
                          >
                            {formatCnae(lead.company.cnaePrincipal)}
                          </div>
                        </td>

                        {/* 3. Status Comercial */}
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${statusBadgeStyle(lead.status)}`}
                          >
                            {statusLabels[lead.status]}
                          </span>
                          {lead.lastContactAt && (
                            <div className="mt-1 text-[10px] text-[#94A3B8]">
                              Último: {formatDateTime(lead.lastContactAt)}
                            </div>
                          )}
                        </td>

                        {/* 4. Prioridade & Score */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-bold ${priorityClass(lead.potentialLevel)}`}
                            >
                              {potentialLabels[lead.potentialLevel]}
                            </span>
                            <ScoreBreakdownTooltip
                              score={lead.score}
                              variant="subtle"
                              breakdown={lead.scoreBreakdown}
                            />
                          </div>
                        </td>

                        {/* 5. Contatos (Pop-over único consolidado) */}
                        <td className="px-4 py-3">
                          <LeadContactsPopover company={lead.company} />
                        </td>

                        {/* 6. Abrir no Mapa */}
                        <td className="px-4 py-3 text-center">
                          <Link
                            to="/mapa-oportunidades"
                            search={{
                              companyId: lead.companyId,
                              city: lead.company.cidade,
                              uf: lead.company.uf,
                            }}
                            className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-semibold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF] cursor-pointer"
                            title="Visualizar este estabelecimento no mapa"
                          >
                            <MapPin className="h-3.5 w-3.5 text-[#ED1C24]" />
                            <span>Abrir no mapa</span>
                          </Link>
                        </td>

                        {/* 7. Ações (Menu 3 pontos simplificado) */}
                        <td className="px-4 py-3 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#DDE5EF] bg-white text-[#64748B] transition hover:border-[#1061AF] hover:text-[#0B1F33] cursor-pointer"
                              >
                                <EllipsisVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-52 border-[#DDE5EF] bg-white text-[#0B1F33]"
                            >
                              <DropdownMenuItem
                                onClick={() => setSelectedLeadId(lead.id)}
                                className="cursor-pointer"
                              >
                                <Eye className="h-4 w-4 text-[#1061AF] mr-2" />
                                Ver detalhes
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickContact(lead)}
                                className="cursor-pointer"
                              >
                                <PhoneCall className="h-4 w-4 text-[#1061AF] mr-2" />
                                Registrar contato
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void quickUpdateStatus(lead, "INTERESTED")}
                                className="cursor-pointer"
                              >
                                Marcar como interessado
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdateStatus(lead, "NEGOTIATION")}
                                className="cursor-pointer"
                              >
                                Enviar para negociação
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdateStatus(lead, "CONVERTED")}
                                className="cursor-pointer font-semibold text-emerald-700"
                              >
                                Converter em cliente
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void quickUpdateStatus(lead, "NOT_INTERESTED")}
                                className="cursor-pointer font-semibold text-[#ED1C24]"
                              >
                                Descartar oportunidade
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdateStatus(lead, "INACTIVE")}
                                className="cursor-pointer text-slate-600"
                              >
                                Marcar como inativo / inexistente
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              label="leads"
            />
          </section>
        )}

        <LeadDetailsSheet
          leadId={selectedLeadId}
          open={!!selectedLeadId}
          onOpenChange={(open) => {
            if (!open) setSelectedLeadId(null);
          }}
          onUpdated={() => void loadLeads()}
        />
      </div>
    </TooltipProvider>
  );
}

function MetricCard({
  label,
  value,
  description,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  accent: string;
}) {
  return (
    <div className="relative flex min-h-[76px] items-center justify-between gap-3 overflow-hidden rounded-lg border border-[#DDE5EF] bg-white px-4 py-3 shadow-2xs">
      <span
        className="absolute inset-y-3 left-0 w-[3px] rounded-r-full"
        style={{ background: accent }}
      />
      <div className="min-w-0 pl-1">
        <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
        <div className="mt-1 text-2xl font-bold leading-none tabular-nums text-[#0B1F33]">
          {value.toLocaleString("pt-BR")}
        </div>
        <div className="mt-0.5 text-[11px] text-[#94A3B8]">{description}</div>
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${compact ? "h-9 text-xs" : "h-10 text-sm"} w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white`}
      >
        {children}
      </select>
    </label>
  );
}

function SortButton({
  active,
  order,
  onClick,
  children,
}: {
  active: boolean;
  order: "asc" | "desc";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 hover:text-[#0B1F33] cursor-pointer"
    >
      {children}
      <ArrowDownUp className={`h-3.5 w-3.5 ${active ? "text-[#1061AF]" : "text-[#CBD5E1]"}`} />
      {active && <span className="text-[10px] lowercase text-[#1061AF]">{order}</span>}
    </button>
  );
}
