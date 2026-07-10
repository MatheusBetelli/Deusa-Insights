import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
import { companyName, formatCnae, formatDateTime, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { leadsService } from "@/services/leadsService";
import type { Lead, LeadStatus, PotentialLevel } from "@/types/lead";
import { Building2, Download, Eye, FileUp, PhoneCall, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  SituacaoCadastralBadge,
  NivelOportunidadeBadge,
  StatusVerificacaoBadge,
  ConfiancaBadge,
  PendenteBadge
} from "@/components/app/QualityBadges";

export const Route = createFileRoute("/_app/leads-b2b")({
  component: LeadsB2B,
});

const PAGE_SIZE = 10;

function statusClass(status: LeadStatus) {
  if (status === "CONVERTED") return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
  if (status === "NEGOTIATION") return "bg-[#1061AF]/10 text-[#0F58A0] ring-1 ring-[#1061AF]/20";
  if (status === "INTERESTED") return "bg-[#FFF200]/30 text-[#854D0E] ring-1 ring-[#CA8A04]/30";
  if (status === "NOT_INTERESTED" || status === "INACTIVE") return "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
  return "bg-white text-[#0B1F33] ring-1 ring-[#DDE5EF]";
}

function priorityClass(priority: PotentialLevel) {
  if (priority === "CRITICAL") return "bg-[#ED1C24]/10 text-[#ED1C24] ring-1 ring-[#ED1C24]/20";
  if (priority === "HIGH") return "bg-[#F97316]/10 text-[#C2410C] ring-1 ring-[#F97316]/20";
  return "bg-[#1061AF]/10 text-[#0F58A0] ring-1 ring-[#1061AF]/20";
}

function clean<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== "Todos" && item !== "Todas" && item !== "")) as T;
}

function LeadsB2B() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [referenceLeads, setReferenceLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("Todas");
  const [cnae, setCnae] = useState("Todos");
  const [status, setStatus] = useState("Todos");
  const [potentialLevel, setPotentialLevel] = useState("Todos");
  const [assignedToId, setAssignedToId] = useState("Todos");
  const [statusVerificacaoEndereco, setStatusVerificacaoEndereco] = useState("Todos");
  const [pendenteValidacao, setPendenteValidacao] = useState("Todos");
  const [nivelOportunidade, setNivelOportunidade] = useState("Todos");
  const [situacaoCadastral, setSituacaoCadastral] = useState("ATIVA");
  const [page, setPage] = useState(1);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const data = await leadsService.getLeads(
        clean({
          search: query,
          city,
          cnae,
          status: status as LeadStatus | "Todos",
          potentialLevel: potentialLevel as PotentialLevel | "Todos",
          assignedToId,
        }),
      );
      setLeads(data);
      if (!query && city === "Todas" && cnae === "Todos" && status === "Todos" && potentialLevel === "Todos" && assignedToId === "Todos") {
        setReferenceLeads(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    const timer = window.setTimeout(loadLeads, 250);
    return () => window.clearTimeout(timer);
  }, [query, city, cnae, status, potentialLevel, assignedToId, statusVerificacaoEndereco, pendenteValidacao, nivelOportunidade, situacaoCadastral]);

  const optionSource = referenceLeads.length ? referenceLeads : leads;
  const cities = Array.from(new Set(optionSource.map((lead) => lead.company.cidade))).sort();
  const cnaes = Array.from(new Set(optionSource.map((lead) => lead.company.cnaePrincipal).filter(Boolean))) as string[];
  const owners = useMemo(
    () =>
      Array.from(new Map(optionSource.filter((lead) => lead.assignedTo).map((lead) => [lead.assignedTo!.id, lead.assignedTo!])).values()),
    [optionSource],
  );
  const highPotentialCount = leads.filter((lead) => lead.potentialLevel === "HIGH" || lead.potentialLevel === "CRITICAL").length;

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusVerificacaoEndereco !== "Todos" && lead.company.statusVerificacaoEndereco !== statusVerificacaoEndereco) {
        return false;
      }
      if (pendenteValidacao !== "Todos") {
        const isPendente = !!lead.company.pendenteValidacao;
        if (pendenteValidacao === "Sim" && !isPendente) return false;
        if (pendenteValidacao === "Não" && isPendente) return false;
      }
      if (nivelOportunidade !== "Todos" && lead.company.nivelOportunidade !== nivelOportunidade) {
        return false;
      }
      if (situacaoCadastral !== "Todos" && lead.company.situacaoCadastral !== situacaoCadastral) {
        return false;
      }
      return true;
    });
  }, [leads, statusVerificacaoEndereco, pendenteValidacao, nivelOportunidade, situacaoCadastral]);

  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / PAGE_SIZE));
  const visibleLeads = filteredLeads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleContact(lead: Lead) {
    if (!lead.assignedToId) {
      toast.error("Lead sem responsável para registrar contato.");
      return;
    }
    await leadsService.createInteraction(lead.id, {
      userId: lead.assignedToId,
      type: "Contato comercial",
      description: "Contato registrado pela tela de Leads B2B.",
    });
    toast.success(`Contato registrado para ${companyName(lead.company)}.`);
    loadLeads();
  }

  return (
    <div>
      <PageHeader
        title="Leads B2B"
        subtitle="Encontre leads prioritários e registre a próxima ação comercial."
        actions={
          <>
            <Link to="/importar-cnpjs" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF]">
              <FileUp className="h-4 w-4 text-[#FFF200]" />
              Importar CNPJs
            </Link>
            <button onClick={() => toast.success("CSV preparado para exportação futura.")} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-bold text-[#0B1F33] transition hover:border-[#1061AF]">
              <Download className="h-4 w-4 text-[#1061AF]" />
              Exportar CSV
            </button>
          </>
        }
      />

      <section className="mb-4 grid gap-4 sm:grid-cols-2">
        {[
          { label: "Total de leads", value: leads.length },
          { label: "Alto potencial", value: highPotentialCount },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-2xl font-bold text-[#0B1F33] tabular-nums">{card.value}</div>
                <div className="mt-1 text-xs font-semibold text-[#64748B]">{card.label}</div>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1061AF]/10">
                <Building2 className="h-4 w-4 text-[#1061AF]" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-4 rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm">
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <label className="block sm:col-span-2 lg:col-span-3 xl:col-span-2">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Busca</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Empresa, CNPJ ou cidade" className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm outline-none focus:border-[#1061AF]" />
            </div>
          </label>
          {[
            { label: "Cidade", value: city, set: setCity, options: ["Todas", ...cities] },
            { label: "CNAE", value: cnae, set: setCnae, options: ["Todos", ...cnaes] },
            { label: "Status Comercial", value: status, set: setStatus, options: ["Todos", ...Object.keys(statusLabels)] },
            { label: "Responsável", value: assignedToId, set: setAssignedToId, options: ["Todos", ...owners.map((owner) => owner.id)], labels: Object.fromEntries(owners.map((owner) => [owner.id, owner.name])) },
          ].map((filter) => (
            <label key={filter.label} className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">{filter.label}</span>
              <select value={filter.value} onChange={(event) => filter.set(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
                {filter.options.map((option) => (
                  <option key={option} value={option}>
                    {(filter as any).labels?.[option] ?? statusLabels[option as LeadStatus] ?? potentialLabels[option as PotentialLevel] ?? (filter.label === "CNAE" && option !== "Todos" ? formatCnae(option) : option)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {/* Segunda linha de filtros: Qualidade e Validação */}
        <div className="mt-3 border-t border-[#EEF2F7] pt-3 grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Oportunidade</span>
            <select value={nivelOportunidade} onChange={(event) => setNivelOportunidade(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option value="Todos">Todas as oportunidades</option>
              <option value="alta">Alta</option>
              <option value="media">Média</option>
              <option value="baixa">Baixa</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Verificação Endereço</span>
            <select value={statusVerificacaoEndereco} onChange={(event) => setStatusVerificacaoEndereco(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option value="Todos">Todos os status</option>
              <option value="confiavel_cadastralmente">Confiável Cadastralmente</option>
              <option value="aproximado">Aproximado</option>
              <option value="nao_verificado">Não Verificado</option>
              <option value="verificado">Verificado</option>
              <option value="divergente">Divergente</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Pendente Validação</span>
            <select value={pendenteValidacao} onChange={(event) => setPendenteValidacao(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option value="Todos">Qualquer estado</option>
              <option value="Sim">Apenas pendentes ⚠️</option>
              <option value="Não">Sem pendências</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold uppercase text-[#64748B]">Situação Cadastral</span>
            <select value={situacaoCadastral} onChange={(event) => setSituacaoCadastral(event.target.value)} className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]">
              <option value="Todos">Todas as situações</option>
              <option value="ATIVA">ATIVA</option>
              <option value="BAIXADA">BAIXADA</option>
              <option value="INAPTA">INAPTA</option>
              <option value="SUSPENSA">SUSPENSA</option>
              <option value="NULA">NULA</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              onClick={() => {
                setCity("Todas");
                setCnae("Todos");
                setStatus("Todos");
                setPotentialLevel("Todos");
                setAssignedToId("Todos");
                setStatusVerificacaoEndereco("Todos");
                setPendenteValidacao("Todos");
                setNivelOportunidade("Todos");
                setSituacaoCadastral("Todos");
              }}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white text-xs font-bold text-[#64748B] transition hover:bg-[#F8FAFC] hover:text-[#0B1F33]"
            >
              Limpar Filtros
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="mb-4">
          <ErrorState description={error} action={<button onClick={loadLeads} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} />
        </div>
      )}

      {loading ? (
        <LoadingState message="Carregando leads B2B..." />
      ) : leads.length === 0 ? (
        <EmptyState title="Nenhum lead encontrado" description="Não há leads para os filtros selecionados. Limpe os filtros ou importe novos CNPJs." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="border-b border-[#DDE5EF] bg-[#F8FAFC] text-[11px] font-bold uppercase text-[#64748B]">
                <tr>
                  <th className="px-4 py-3">Empresa</th>
                  <th className="px-4 py-3">Cidade / Situação</th>
                  <th className="px-4 py-3">CNAE</th>
                  <th className="px-4 py-3">Status Comercial</th>
                  <th className="px-4 py-3">Score / Oportunidade</th>
                  <th className="px-4 py-3">Confiança / Verificação</th>
                  <th className="px-4 py-3">Responsável</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {visibleLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#F8FAFC]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 font-bold text-[#0B1F33]">
                        {companyName(lead.company)}
                        {lead.company.pendenteValidacao && (
                          <span className="text-orange-500 hover:text-orange-600 cursor-help" title="Pendente de validação manual">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-[#0B1F33] font-medium">{lead.company.cidade}/{lead.company.uf}</div>
                      <div className="mt-0.5">
                        <SituacaoCadastralBadge situacao={lead.company.situacaoCadastral} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{formatCnae(lead.company.cnaePrincipal)}</td>
                    <td className="px-4 py-3">
                      <div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(lead.status)}`}>
                          {statusLabels[lead.status]}
                        </span>
                      </div>
                      {lead.lastContactAt && (
                        <div className="mt-1 text-[10px] text-[#64748B]">
                          Contato: {formatDateTime(lead.lastContactAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 min-w-9 items-center justify-center rounded-md bg-[#1061AF]/10 px-2 text-xs font-bold text-[#0F58A0] tabular-nums">
                          {lead.score}
                        </span>
                        <NivelOportunidadeBadge nivel={lead.company.nivelOportunidade} />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#64748B]">Confiança:</span>
                          <ConfiancaBadge confianca={lead.company.confiancaVerificacao} />
                        </div>
                        <div>
                          <StatusVerificacaoBadge status={lead.company.statusVerificacaoEndereco} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{lead.assignedTo?.name ?? "Sem responsável"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to="/leads-b2b/$leadId" params={{ leadId: lead.id }} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-white px-2.5 text-xs font-bold text-[#0B1F33] hover:border-[#1061AF]">
                          <Eye className="h-3.5 w-3.5" />
                          Ver
                        </Link>
                        <button onClick={() => handleContact(lead)} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[#0B1F33] px-2.5 text-xs font-bold text-white hover:bg-[#1061AF]">
                          <PhoneCall className="h-3.5 w-3.5 text-[#FFF200]" />
                          Contato
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#DDE5EF] px-4 py-3 text-xs font-medium text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {visibleLeads.length} de {filteredLeads.length} leads {filteredLeads.length !== leads.length && `(filtrados de ${leads.length})`}
            </span>
            <div className="flex items-center gap-2">
              <button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} className="h-8 rounded-md border border-[#DDE5EF] bg-white px-3 font-bold text-[#0B1F33] disabled:cursor-not-allowed disabled:opacity-40">
                Anterior
              </button>
              <span>Página {page} de {totalPages}</span>
              <button disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className="h-8 rounded-md border border-[#DDE5EF] bg-white px-3 font-bold text-[#0B1F33] disabled:cursor-not-allowed disabled:opacity-40">
                Próxima
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
