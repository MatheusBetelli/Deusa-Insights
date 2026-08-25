import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import {
  LeadContactsPopover,
  extractCompanyContacts,
} from "@/features/leads/components/LeadContactsPopover";
import { ScoreBreakdownTooltip } from "@/components/common/ScoreBreakdownTooltip";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  companyName,
  formatCnae,
  formatCnpj,
  formatDateTime,
  potentialLabels,
  statusLabels,
} from "@/lib/commercial-formatters";
import { leadsService } from "@/services/leadsService";
import { companiesService } from "@/services/companiesService";
import type { Lead, LeadStatus } from "@/types/lead";
import { hasCurrentClientAccount } from "@/lib/client-status";
import type { CompanyDetailsResponse } from "@/types/company-details";
import {
  Building2,
  CheckCircle2,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Save,
  ShoppingBag,
  X,
} from "lucide-react";
import { AuthService } from "@/lib/auth";

type LeadDetailsSheetProps = {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

const STORE_URL = import.meta.env.VITE_STORE_URL || "https://loja.deusalimentos.com.br";

function getEstablishmentSegment(cnae?: string | null): string {
  const norm = (cnae ?? "").replace(/\D/g, "");
  if (norm === "4711302" || norm === "4711301") return "SUPERMERCADO";
  if (norm === "4721102" || norm === "4721100" || norm === "1091101" || norm === "1091102")
    return "PADARIA";
  if (norm === "4712100") return "MINIMERCADO / MERCEARIA";
  if (norm === "4722901") return "AÇOUGUE";
  return "MINIMERCADO / MERCEARIA";
}

export function LeadDetailsSheet({ leadId, open, onOpenChange, onUpdated }: LeadDetailsSheetProps) {
  const leadRequestSequence = useRef(0);
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LeadStatus>("NEW");

  // Registro de contato
  const [contactChannel, setContactChannel] = useState<
    "Telefone" | "WhatsApp" | "E-mail" | "Visita"
  >("Telefone");
  const [contactDescription, setContactDescription] = useState("");

  // Dados complementares em modo visualização / edição
  const [isEditingData, setIsEditingData] = useState(false);
  const [detailsResponse, setDetailsResponse] = useState<CompanyDetailsResponse | null>(null);
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [naturezaJuridica, setNaturezaJuridica] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  const currentUser = AuthService.getUser();

  const loadLead = useCallback(async () => {
    if (!leadId) return;
    const requestId = ++leadRequestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const leadData = await leadsService.getLead(leadId);
      if (requestId !== leadRequestSequence.current) return;
      const detailsData = await companiesService.getCompanyDetails(leadData.companyId);
      if (requestId !== leadRequestSequence.current) return;

      setLead(leadData);
      setStatus(leadData.status);

      if (detailsData) {
        setDetailsResponse(detailsData);
        setTelefone(detailsData.details?.telefone ?? "");
        setEmail(detailsData.details?.email ?? "");
        setNaturezaJuridica(detailsData.details?.naturezaJuridica ?? "");
      } else {
        setDetailsResponse(null);
        setTelefone("");
        setEmail("");
        setNaturezaJuridica("");
      }
      setIsEditingData(false);
    } catch (err) {
      if (requestId !== leadRequestSequence.current) return;
      setError(
        err instanceof Error ? err.message : "Não foi possível carregar os detalhes do lead.",
      );
    } finally {
      if (requestId === leadRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      void loadLead();
    }
    return () => {
      leadRequestSequence.current += 1;
    };
  }, [open, loadLead]);

  async function handleStatusChange(nextStatus: LeadStatus) {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await leadsService.updateLead(lead.id, { status: nextStatus });
      setStatus(nextStatus);
      setLead((current) =>
        current
          ? {
              ...current,
              status: nextStatus,
            }
          : updated,
      );
      toast.success(`Status comercial alterado para ${statusLabels[nextStatus]}.`);
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o status.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDetails() {
    if (!lead) return;
    setSavingDetails(true);
    try {
      const response = await companiesService.upsertCompanyDetails(lead.companyId, {
        telefone,
        email,
        naturezaJuridica,
      });
      setDetailsResponse(response);
      setIsEditingData(false);
      toast.success("Dados cadastrais salvos com sucesso.");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível salvar os dados.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function handleRegisterContact() {
    if (!lead) return;
    const activeUserId = currentUser?.id || lead.assignedToId || "admin";

    setSaving(true);
    try {
      const fullDesc = `[${contactChannel}] ${contactDescription.trim() || "Contato registrado pelo painel comercial."}`;
      await leadsService.createInteraction(lead.id, {
        userId: activeUserId,
        type: `Contato (${contactChannel})`,
        description: fullDesc,
      });
      const nextStatus = status === "NEW" || status === "NO_CONTACT" ? "CONTACTED" : status;
      setStatus(nextStatus);
      setContactDescription("");
      toast.success("Histórico de contato registrado.");
      onUpdated?.();
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar o contato.");
    } finally {
      setSaving(false);
    }
  }

  function handleSendStoreLink() {
    if (!lead) return;
    const contacts = extractCompanyContacts(lead.company);
    const mobileContact = contacts.find((c) => c.type === "phone" && c.isMobile);
    const message = encodeURIComponent(
      `Olá! Somos da Deusa Alimentos. Segue o link da nossa loja oficial B2B para pedidos: ${STORE_URL}`,
    );
    if (mobileContact) {
      window.open(`https://wa.me/${mobileContact.raw}?text=${message}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${message}`, "_blank");
    }
  }

  const company = lead?.company;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto bg-white p-0 sm:max-w-xl text-[#0B1F33]"
      >
        <SheetHeader className="border-b border-[#DDE5EF] bg-[#F8FAFC] px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-[#0B1F33] text-lg font-bold">
            <Building2 className="h-5 w-5 text-[#1061AF]" />
            Ficha Comercial do Lead
          </SheetTitle>
          <SheetDescription className="text-xs text-[#64748B]">
            Informações estratégicas de prospecção e ações comerciais diretas.
          </SheetDescription>
        </SheetHeader>

        <div className="p-5 space-y-4">
          {loading ? (
            <LoadingState message="Carregando dados do estabelecimento..." />
          ) : error ? (
            <ErrorState
              description={error}
              action={
                <button
                  onClick={() => void loadLead()}
                  className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white cursor-pointer"
                >
                  Tentar novamente
                </button>
              }
            />
          ) : !lead || !company ? (
            <EmptyState
              title="Lead não selecionado"
              description="Selecione um estabelecimento para visualizar sua ficha comercial."
            />
          ) : (
            <>
              {/* Status Especial: Cliente Convertido */}
              {hasCurrentClientAccount(company.clientAccounts) && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-2xs">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      Cliente Deusa Alimentos
                    </div>
                    <div className="text-xs text-emerald-700">
                      Este estabelecimento já faz parte da nossa carteira de clientes ativas.
                    </div>
                  </div>
                </div>
              )}

              {/* 1. Cabeçalho Principal da Ficha */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs space-y-3">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[#1061AF]">
                    {getEstablishmentSegment(company.cnaePrincipal)}
                  </span>
                  <h2 className="text-xl font-bold leading-tight text-[#0B1F33] mt-0.5">
                    {companyName(company)}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-[#64748B] mt-1">
                    <span>{formatCnpj(company.cnpj)}</span>
                    <span>·</span>
                    <span className="font-sans font-medium text-[#0B1F33]">
                      {company.cidade}/{company.uf}
                    </span>
                  </div>
                </div>

                {/* Ações Compactas do Cabeçalho */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EEF2F7]">
                  <LeadContactsPopover company={company} />

                  <Link
                    to="/mapa-oportunidades"
                    search={{ companyId: company.id, city: company.cidade, uf: company.uf }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-semibold text-[#0B1F33] transition hover:border-[#1061AF] hover:text-[#1061AF] cursor-pointer shadow-2xs"
                    title="Localizar no Mapa de Oportunidades"
                  >
                    <MapPin className="h-3.5 w-3.5 text-[#ED1C24]" />
                    <span>Abrir no mapa</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleSendStoreLink}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#DDE5EF] bg-white px-3 text-xs font-semibold text-[#0B1F33] transition hover:border-[#128C7E] hover:text-[#128C7E] cursor-pointer shadow-2xs"
                    title="Enviar link da loja virtual B2B via WhatsApp"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-[#128C7E]" />
                    <span>Enviar link da loja</span>
                  </button>
                </div>
              </section>

              {/* 2. Dados Comerciais (Ex-Classificação Inteligente) & Score Único */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Dados Comerciais
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[#64748B] font-medium">Prioridade:</span>
                    <ScoreBreakdownTooltip
                      score={lead.score}
                      breakdown={lead.scoreBreakdown}
                      variant="default"
                    />
                  </div>
                </div>

                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <Info
                    label="Segmento Alvo"
                    value={getEstablishmentSegment(company.cnaePrincipal)}
                  />
                  <Info
                    label="Porte Estimado"
                    value={
                      company.porte || detailsResponse?.classification?.size || "Não informado"
                    }
                  />
                  <Info label="CNAE Principal" value={formatCnae(company.cnaePrincipal)} />
                  <Info label="Região comercial" value={`${company.cidade}/${company.uf}`} />
                  <Info label="Situação Cadastral" value={company.situacaoCadastral || "ATIVA"} />
                  <Info
                    label="Prioridade Comercial"
                    value={`${potentialLabels[lead.potentialLevel]} (${lead.score} pts)`}
                  />
                </div>
              </section>

              {/* 3. Dados do Estabelecimento (Modo Texto vs Edição) */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
                <div className="flex items-center justify-between border-b border-[#EEF2F7] pb-2 mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    Informações do Estabelecimento
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsEditingData((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#1061AF] hover:underline cursor-pointer"
                  >
                    {isEditingData ? (
                      <>
                        <X className="h-3.5 w-3.5" />
                        Cancelar edição
                      </>
                    ) : (
                      <>
                        <Pencil className="h-3.5 w-3.5" />
                        Editar dados
                      </>
                    )}
                  </button>
                </div>

                {!isEditingData ? (
                  <div className="space-y-2 text-xs">
                    <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#EEF2F7]">
                      <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-0.5">
                        Endereço
                      </div>
                      <div className="font-medium text-[#0B1F33]">
                        {[company.logradouro, company.numero, company.bairro, company.cep]
                          .filter(Boolean)
                          .join(", ") || "Endereço não informado"}
                        {company.cidade && ` – ${company.cidade}/${company.uf}`}
                      </div>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#EEF2F7]">
                        <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-0.5">
                          Telefone principal
                        </div>
                        <div className="font-mono font-medium text-[#0B1F33]">
                          {telefone ||
                            company.telefone ||
                            company.telefoneEncontrado ||
                            "Não informado"}
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#EEF2F7]">
                        <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-0.5">
                          E-mail de contato
                        </div>
                        <div className="font-medium text-[#0B1F33] truncate">
                          {email || company.email ? (
                            <a
                              href={`mailto:${email || company.email}`}
                              className="text-[#1061AF] hover:underline"
                            >
                              {email || company.email}
                            </a>
                          ) : (
                            "Não informado"
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#EEF2F7]">
                      <div className="text-[10px] font-bold uppercase text-[#94A3B8] mb-0.5">
                        Natureza jurídica
                      </div>
                      <div className="font-medium text-[#0B1F33]">
                        {naturezaJuridica || "Não informada"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-[#64748B]">
                          Telefone
                        </span>
                        <input
                          type="text"
                          value={telefone}
                          onChange={(e) => setTelefone(e.target.value)}
                          className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                          placeholder="(14) 3471-0000"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs font-bold text-[#64748B]">E-mail</span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                          placeholder="contato@empresa.com.br"
                        />
                      </label>
                    </div>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-[#64748B]">
                        Natureza Jurídica
                      </span>
                      <input
                        type="text"
                        value={naturezaJuridica}
                        onChange={(e) => setNaturezaJuridica(e.target.value)}
                        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                        placeholder="Ex: Sociedade Empresária Limitada"
                      />
                    </label>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsEditingData(false)}
                        className="h-9 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-semibold text-[#0B1F33] hover:border-[#1061AF] cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveDetails()}
                        disabled={savingDetails}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-semibold text-white hover:bg-[#1061AF] disabled:opacity-60 cursor-pointer"
                      >
                        {savingDetails ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 text-[#FFF200]" />
                        )}
                        Salvar dados
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* 4. Etapa do Funil Comercial */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
                  Etapa Comercial
                </h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { id: "NEW", label: "Novo" },
                    { id: "CONTACTED", label: "Contatado" },
                    { id: "INTERESTED", label: "Interessado" },
                    { id: "NEGOTIATION", label: "Em negociação" },
                    { id: "CONVERTED", label: "Cliente" },
                    { id: "NOT_INTERESTED", label: "Descartado" },
                    { id: "INACTIVE", label: "Inativo / Fechado" },
                  ].map((item) => {
                    const isSelected = status === item.id;
                    const isClient = item.id === "CONVERTED";
                    const isDiscarded = item.id === "NOT_INTERESTED";
                    const isInactive = item.id === "INACTIVE";

                    let btnStyle =
                      "border-[#DDE5EF] bg-[#F8FAFC] text-[#475569] hover:border-[#1061AF]";
                    if (isSelected) {
                      if (isClient)
                        btnStyle = "border-emerald-500 bg-emerald-600 text-white font-bold";
                      else if (isDiscarded)
                        btnStyle = "border-[#ED1C24] bg-[#ED1C24] text-white font-bold";
                      else if (isInactive)
                        btnStyle = "border-slate-400 bg-slate-600 text-white font-bold";
                      else btnStyle = "border-[#0B1F33] bg-[#0B1F33] text-white font-bold";
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={saving}
                        onClick={() => void handleStatusChange(item.id as LeadStatus)}
                        className={`h-9 rounded-lg border text-xs transition cursor-pointer disabled:opacity-60 ${btnStyle}`}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* 5. Registrar Histórico de Contato */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
                  Registrar Contato Realizado
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#64748B]">Canal:</span>
                    {(["Telefone", "WhatsApp", "E-mail", "Visita"] as const).map((channel) => (
                      <button
                        key={channel}
                        type="button"
                        onClick={() => setContactChannel(channel)}
                        className={`h-7 px-2.5 rounded-md text-xs font-semibold transition cursor-pointer border ${
                          contactChannel === channel
                            ? "bg-[#0B1F33] text-white border-[#0B1F33]"
                            : "bg-[#F8FAFC] text-[#475569] border-[#DDE5EF] hover:border-[#1061AF]"
                        }`}
                      >
                        {channel}
                      </button>
                    ))}
                  </div>

                  <textarea
                    value={contactDescription}
                    onChange={(event) => setContactDescription(event.target.value)}
                    rows={2}
                    placeholder="Resumo objetivo da abordagem comercial..."
                    className="w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-2.5 text-xs text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white"
                  />

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void handleRegisterContact()}
                      disabled={saving}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-3.5 text-xs font-semibold text-white transition hover:bg-[#1061AF] disabled:opacity-60 cursor-pointer"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#FFF200]" />
                      ) : (
                        <MessageSquare className="h-4 w-4 text-[#FFF200]" />
                      )}
                      Registrar contato
                    </button>
                  </div>
                </div>
              </section>

              {/* 6. Histórico Comercial de Contatos */}
              <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-2xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B] mb-3">
                  Histórico Comercial
                </h3>
                <div className="space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2 text-xs mb-3">
                    <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#EEF2F7]">
                      <div className="text-[10px] font-bold uppercase text-[#94A3B8]">
                        Último contato
                      </div>
                      <div className="font-semibold text-[#0B1F33] mt-0.5">
                        {formatDateTime(lead.lastContactAt)}
                      </div>
                    </div>
                    <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#EEF2F7]">
                      <div className="text-[10px] font-bold uppercase text-[#94A3B8]">
                        Próxima ação
                      </div>
                      <div className="font-semibold text-[#0B1F33] mt-0.5">
                        {formatDateTime(lead.nextActionAt)}
                      </div>
                    </div>
                  </div>

                  {(lead.interactions ?? []).length === 0 ? (
                    <p className="text-xs text-[#94A3B8] italic">
                      Nenhum histórico registrado até o momento.
                    </p>
                  ) : (
                    lead.interactions?.map((interaction) => (
                      <div
                        key={interaction.id}
                        className="rounded-lg bg-[#F8FAFC] p-3 border border-[#EEF2F7] text-xs"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-bold text-[#0B1F33]">{interaction.type}</span>
                          <span className="text-[10px] text-[#64748B]">
                            {formatDateTime(interaction.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-[#475569]">{interaction.description}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#F8FAFC] p-2.5 border border-[#EEF2F7]">
      <div className="text-[10px] font-bold uppercase text-[#94A3B8]">{label}</div>
      <div className="mt-0.5 font-semibold text-[#0B1F33] truncate" title={value}>
        {value}
      </div>
    </div>
  );
}
