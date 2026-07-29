import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { LeadDetailsSheet } from "@/features/leads/components/LeadDetailsSheet";
import { PaginationBar } from "@/components/common/PaginationBar";
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
  PhoneCall,
  Search,
  SlidersHorizontal,
  UserPlus,
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

export type LeadsB2BSearch = {
  search?: string;
  uf?: string;
  city?: string;
  cnae?: string;
  status?: string;
  potentialLevel?: string;
};

export const Route = createFileRoute("/_app/leads-b2b")({
  validateSearch: (search: Record<string, unknown>): LeadsB2BSearch => ({
    search: typeof search.search === "string" ? search.search : undefined,
    uf: typeof search.uf === "string" ? search.uf : undefined,
    city: typeof search.city === "string" ? search.city : undefined,
    cnae: typeof search.cnae === "string" ? search.cnae : undefined,
    status: typeof search.status === "string" ? search.status : undefined,
    potentialLevel: typeof search.potentialLevel === "string" ? search.potentialLevel : undefined,
  }),
  component: LeadsB2B,
});

const PAGE_SIZE = 25;

const verificationLabels: Record<string, string> = {
  confiavel_cadastralmente: "Confiável cadastralmente",
  aproximado: "Aproximado",
  nao_verificado: "Não verificado",
  verificado: "Verificado",
  divergente: "Divergente",
};

type SortBy = NonNullable<LeadQuery["sortBy"]>;

function isPriorityOpportunity(priority: PotentialLevel) {
  return priority === "CRITICAL" || priority === "HIGH";
}

function verificationLabel(status?: string | null) {
  if (!status) return "Não verificado";
  return verificationLabels[status] ?? status;
}

function priorityClass(priority: PotentialLevel) {
  if (priority === "CRITICAL") return "border-[#ED1C24]/30 bg-[#ED1C24]/10 text-[#B91C1C]";
  if (priority === "HIGH") return "border-[#F97316]/30 bg-[#FFF7ED] text-[#C2410C]";
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#64748B]";
}

function statusClass() {
  return "border-[#DDE5EF] bg-[#F8FAFC] text-[#475569]";
}

function LeadsB2B() {
  const routeSearch = Route.useSearch();
  const [autoAssigning, setAutoAssigning] = useState(false);
  const currentUser = AuthService.getUser();

  async function handleAutoAssignTerritory() {
    setAutoAssigning(true);
    try {
      const res = await leadsService.autoAssignTerritory();
      toast.success(res.message);
      await loadLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao distribuir leads.");
    } finally {
      setAutoAssigning(false);
    }
  }
  const [leads, setLeads] = useState<Lead[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [cnaes, setCnaes] = useState<Cnae[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(routeSearch.search || "");
  const [uf, setUf] = useState(routeSearch.uf || "Todos");
  const [city, setCity] = useState(routeSearch.city || "Todas");
  const [cnae, setCnae] = useState(routeSearch.cnae || "Todos");
  const [status, setStatus] = useState(routeSearch.status || "Todos");
  const [potentialLevel, setPotentialLevel] = useState(routeSearch.potentialLevel || "Todos");
  const [statusVerificacaoEndereco, setStatusVerificacaoEndereco] = useState("Todos");
  const [pendenteValidacao, setPendenteValidacao] = useState("Todos");
  const [situacaoCadastral, setSituacaoCadastral] = useState("ATIVA");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [highPotentialCount, setHighPotentialCount] = useState(0);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  useEffect(() => {
    setQuery(routeSearch.search ?? "");
    setUf(routeSearch.uf ?? "");
    setCity(routeSearch.city ?? "");
    setCnae(routeSearch.cnae ?? "");
    setStatus(routeSearch.status ?? "");
    setPotentialLevel(routeSearch.potentialLevel ?? "");
    setPage(1);
  }, [
    routeSearch.search,
    routeSearch.uf,
    routeSearch.city,
    routeSearch.cnae,
    routeSearch.status,
    routeSearch.potentialLevel,
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
    setLoading(true);
    setError(null);
    try {
      const data = await leadsService.getLeadsPage({
        ...baseFilters,
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
      });
      setLeads(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);

      const highCount = await countPriorityLeads(baseFilters);
      setHighPotentialCount(highCount);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar leads.");
    } finally {
      setLoading(false);
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

  async function quickUpdate(lead: Lead, payload: Partial<Pick<Lead, "status" | "assignedToId">>) {
    try {
      await leadsService.updateLead(lead.id, payload);
      toast.success("Lead atualizado.");
      await loadLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o lead.");
    }
  }

  async function quickContact(lead: Lead) {
    if (!lead.assignedToId) {
      toast.error("Atribua um responsável antes de registrar contato.");
      return;
    }
    try {
      await leadsService.createInteraction(lead.id, {
        userId: lead.assignedToId,
        type: "Contato comercial",
        description: "Contato registrado pela lista de Leads B2B.",
      });
      await leadsService.updateLead(lead.id, {
        status: lead.status === "NEW" || lead.status === "NO_CONTACT" ? "CONTACTED" : lead.status,
        lastContactAt: new Date().toISOString(),
      });
      toast.success("Contato registrado.");
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
          value: verificationLabel(statusVerificacaoEndereco),
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
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
            Comercial
          </p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-[#0B1F33]">Leads B2B</h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            Área operacional para priorizar, atribuir e acionar leads.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void handleAutoAssignTerritory()}
            disabled={autoAssigning}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#1061AF] active:scale-[0.99] disabled:opacity-60"
          >
            {autoAssigning ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#FFF200]" />
            ) : (
              <UserPlus className="h-3.5 w-3.5 text-[#FFF200]" />
            )}
            Distribuir por Região
          </button>
          <button
            onClick={() => void handleExportCsv()}
            disabled={exporting}
            className="inline-flex h-9 w-fit items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-sm font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-60"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin text-[#1061AF]" />
            ) : (
              <Download className="h-4 w-4 text-[#1061AF]" />
            )}
            Exportar CSV
          </button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <MetricCard
          label="Total de leads"
          value={total}
          description="Resultados nos filtros atuais"
          accent="#1061AF"
        />
        <MetricCard
          label="Alto potencial"
          value={highPotentialCount}
          description="Alto ou crítico nos filtros"
          accent="#ED1C24"
        />
      </section>

      <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Busca</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Empresa, CNPJ ou cidade"
                className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF]"
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
              .map((option) => (
              <option key={option.id} value={option.name}>
                {option.name}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="CNAE" value={cnae} onChange={setCnae}>
            <option value="Todos">Todos</option>
            {cnaes.map((option) => (
              <option key={option.id} value={option.code}>
                {formatCnae(option.code)}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Oportunidade" value={potentialLevel} onChange={setPotentialLevel}>
            <option value="Todos">Todas</option>
            {Object.entries(potentialLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </FilterSelect>

          <FilterSelect label="Status Comercial" value={status} onChange={setStatus}>
            <option value="Todos">Todos</option>
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
            className="inline-flex h-8 items-center gap-2 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
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
                <option value="Todos">Todos os status</option>
                <option value="confiavel_cadastralmente">Confiável cadastralmente</option>
                <option value="aproximado">Aproximado</option>
                <option value="nao_verificado">Não verificado</option>
                <option value="verificado">Verificado</option>
                <option value="divergente">Divergente</option>
              </FilterSelect>
              <FilterSelect
                label="Validação"
                value={pendenteValidacao}
                onChange={setPendenteValidacao}
                compact
              >
                <option value="Todos">Qualquer estado</option>
                <option value="true">Apenas pendentes</option>
                <option value="false">Sem pendências</option>
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

          <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[#F8FAFC] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase text-[#64748B]">
                Filtros aplicados
              </span>
              {activeFilters.length === 0 ? (
                <span className="text-xs text-[#94A3B8]">Nenhum filtro aplicado</span>
              ) : (
                activeFilters.map((filter) => (
                  <button
                    key={`${filter.label}-${filter.value}`}
                    type="button"
                    onClick={filter.clear}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#DDE5EF] bg-white px-2 py-1 text-[11px] font-semibold text-[#475569] transition hover:border-[#1061AF] hover:text-[#0B1F33]"
                  >
                    <span className="truncate">
                      {filter.label}: {filter.value}
                    </span>
                    <X className="h-3 w-3 shrink-0" />
                  </button>
                ))
              )}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 shrink-0 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
            >
              Limpar tudo
            </button>
          </div>
        </div>
      </section>

      {error && (
        <ErrorState
          description={error}
          action={
            <button
              onClick={() => void loadLeads()}
              className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
            >
              Tentar novamente
            </button>
          }
        />
      )}

      {loading || optionsLoading ? (
        <LoadingState message="Carregando leads B2B..." />
      ) : leads.length === 0 ? (
        <EmptyState
          title="Nenhum lead encontrado"
          description="Ajuste os filtros ou revise a base de dados."
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
          <div className="max-h-[68vh] overflow-auto">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-[#DDE5EF] bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B] shadow-[0_1px_0_0_#DDE5EF]">
                <tr>
                  <th className="px-4 py-2.5">
                    <SortButton
                      active={sortBy === "company"}
                      order={sortOrder}
                      onClick={() => toggleSort("company")}
                    >
                      Empresa / CNPJ
                    </SortButton>
                  </th>
                  <th className="px-4 py-2.5">
                    <SortButton
                      active={sortBy === "city"}
                      order={sortOrder}
                      onClick={() => toggleSort("city")}
                    >
                      Localização / CNAE
                    </SortButton>
                  </th>
                  <th className="px-4 py-2.5">Status Comercial</th>
                  <th className="px-4 py-2.5">
                    <SortButton
                      active={sortBy === "score"}
                      order={sortOrder}
                      onClick={() => toggleSort("score")}
                    >
                      Score
                    </SortButton>
                  </th>
                  <th className="px-4 py-2.5">
                    <SortButton
                      active={sortBy === "potential"}
                      order={sortOrder}
                      onClick={() => toggleSort("potential")}
                    >
                      Oportunidade
                    </SortButton>
                  </th>
                  <th className="px-4 py-2.5">Confiança / Verificação</th>
                  <th className="px-4 py-2.5">Responsável</th>
                  <th className="px-4 py-2.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {leads.map((lead) => {
                  const leadName = companyName(lead.company);
                  const isPriority = isPriorityOpportunity(lead.potentialLevel);

                  return (
                    <tr key={lead.id} className="transition-colors hover:bg-[#F8FAFC]/80">
                      <td className="px-4 py-2.5">
                        <button
                          onClick={() => setSelectedLeadId(lead.id)}
                          className="flex min-w-0 items-start gap-2 text-left"
                        >
                          <div className="min-w-0">
                            <div
                              className="truncate font-bold leading-tight text-[#0B1F33]"
                              title={leadName}
                            >
                              {leadName}
                            </div>
                            <div className="mt-0.5 font-mono text-[11px] leading-tight text-[#64748B]">
                              {formatCnpj(lead.company.cnpj)}
                            </div>
                          </div>
                          {isPriority && (
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ED1C24]" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium leading-tight text-[#0B1F33]">
                          {lead.company.cidade}/{lead.company.uf}
                        </div>
                        <div className="mt-0.5 max-w-[220px] truncate text-[11px] leading-tight text-[#64748B]">
                          {formatCnae(lead.company.cnaePrincipal)}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusClass()}`}
                        >
                          {statusLabels[lead.status]}
                        </span>
                        {lead.lastContactAt && (
                          <div className="mt-1 text-[10px] text-[#94A3B8]">
                            Último contato: {formatDateTime(lead.lastContactAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex h-7 min-w-10 items-center justify-center rounded-md border border-[#DDE5EF] bg-white px-2 text-xs font-bold tabular-nums text-[#0B1F33]">
                          {lead.score}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${priorityClass(lead.potentialLevel)}`}
                        >
                          {potentialLabels[lead.potentialLevel]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold leading-tight text-[#0B1F33]">
                          {lead.company.confiancaVerificacao ?? "Sem score"}
                          {lead.company.confiancaVerificacao != null ? "/100" : ""}
                        </div>
                        <div className="mt-0.5 max-w-[210px] truncate text-[11px] leading-tight text-[#64748B]">
                          {verificationLabel(lead.company.statusVerificacaoEndereco)}
                          {lead.company.pendenteValidacao ? " · Validação pendente" : ""}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {lead.assignedTo ? (
                          <span className="text-xs font-semibold text-[#0B1F33]">
                            {lead.assignedTo.name}
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              if (currentUser?.id) {
                                void quickUpdate(lead, { assignedToId: currentUser.id });
                              } else {
                                setSelectedLeadId(lead.id);
                              }
                            }}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50/80 px-2 text-xs font-bold text-[#1061AF] transition hover:bg-[#1061AF] hover:text-white"
                            title="Atribuir este lead a você com 1 clique"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Atribuir a mim
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedLeadId(lead.id)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0B1F33] px-3 text-xs font-bold text-white transition hover:bg-[#1061AF]"
                          >
                            <Eye className="h-3.5 w-3.5 text-[#FFF200]" />
                            Abrir
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#DDE5EF] bg-white text-[#64748B] transition hover:border-[#1061AF] hover:text-[#0B1F33]">
                                <EllipsisVertical className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-56 border-[#DDE5EF] bg-white text-[#0B1F33]"
                            >
                              <DropdownMenuItem
                                onClick={() => void quickContact(lead)}
                                className="cursor-pointer"
                              >
                                <PhoneCall className="h-4 w-4 text-[#1061AF]" />
                                Registrar contato
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => void quickUpdate(lead, { status: "INTERESTED" })}
                                className="cursor-pointer"
                              >
                                Marcar interessado
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdate(lead, { status: "NEGOTIATION" })}
                                className="cursor-pointer"
                              >
                                Enviar para negociação
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdate(lead, { status: "CONVERTED" })}
                                className="cursor-pointer"
                              >
                                Converter em cliente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void quickUpdate(lead, { status: "NOT_INTERESTED" })}
                                className="cursor-pointer text-[#B91C1C]"
                              >
                                Descartar oportunidade
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
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
    <div className="relative flex min-h-[76px] items-center justify-between gap-3 overflow-hidden rounded-lg border border-[#DDE5EF] bg-white px-4 py-3 shadow-sm">
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
        className={`${compact ? "h-9 text-xs" : "h-10 text-sm"} w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-[#0B1F33] outline-none transition focus:border-[#1061AF]`}
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
      className="inline-flex items-center gap-1 hover:text-[#0B1F33]"
    >
      {children}
      <ArrowDownUp className={`h-3.5 w-3.5 ${active ? "text-[#1061AF]" : "text-[#CBD5E1]"}`} />
      {active && <span className="text-[10px] lowercase text-[#1061AF]">{order}</span>}
    </button>
  );
}
