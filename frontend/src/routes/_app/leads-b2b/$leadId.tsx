import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import {
  AvisoLocalizacaoAproximada,
  ConfiancaBadge,
  NivelOportunidadeBadge,
  PendenteBadge,
  SituacaoCadastralBadge,
  StatusVerificacaoBadge,
} from "@/components/common/QualityBadges";
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
import type { Lead, LeadInteraction, LeadStatus } from "@/types/lead";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquare,
  Navigation,
  Pencil,
  Phone,
  PhoneCall,
  UserCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AuthService } from "@/lib/auth";

export const Route = createFileRoute("/_app/leads-b2b/$leadId")({
  component: LeadDetail,
});

function LeadDetail() {
  const leadRequestSequence = useRef(0);
  const { leadId } = Route.useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modais de interação, planejamento de visita e edição cadastral
  const [showInteractionModal, setShowInteractionModal] = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [interactionForm, setInteractionForm] = useState({
    type: "Ligação comercial",
    result: "CONTACTED",
    description: "",
    nextActionDate: "",
  });

  const [visitForm, setVisitForm] = useState({
    date: "",
    notes: "",
  });

  const [editForm, setEditForm] = useState({
    telefone: "",
    email: "",
    nomeFantasia: "",
    razaoSocial: "",
    logradouro: "",
    numero: "",
    bairro: "",
    cep: "",
    cidade: "",
    uf: "",
  });

  function handleOpenEditModal() {
    if (!lead) return;
    const c = lead.company;
    const ph = c.details?.telefone || c.telefoneEncontrado || c.telefone || "";
    const em = c.details?.email || c.email || "";
    setEditForm({
      telefone: ph,
      email: em,
      nomeFantasia: c.nomeFantasia || "",
      razaoSocial: c.razaoSocial || "",
      logradouro: c.logradouro || "",
      numero: c.numero || "",
      bairro: c.bairro || "",
      cep: c.cep || "",
      cidade: c.cidade || "",
      uf: c.uf || "",
    });
    setShowEditModal(true);
  }

  async function handleSaveCompanyDetails(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;

    try {
      await companiesService.updateCommercialProfile(lead.company.id, {
        telefone: editForm.telefone.trim() || undefined,
        email: editForm.email.trim() || undefined,
        nomeFantasia: editForm.nomeFantasia.trim() || undefined,
        razaoSocial: editForm.razaoSocial.trim() || undefined,
        logradouro: editForm.logradouro.trim() || undefined,
        numero: editForm.numero.trim() || undefined,
        bairro: editForm.bairro.trim() || undefined,
        cep: editForm.cep.trim() || undefined,
        cidade: editForm.cidade.trim() || undefined,
        uf: editForm.uf.trim() ? editForm.uf.trim().toUpperCase() : undefined,
      });

      toast.success("Cadastro e contatos do mercado atualizados com sucesso!");
      setShowEditModal(false);
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar cadastro.");
    }
  }

  const loadLead = useCallback(async () => {
    const requestId = ++leadRequestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const [leadData, interactionData] = await Promise.all([
        leadsService.getLead(leadId),
        leadsService.getInteractions(leadId),
      ]);
      if (requestId !== leadRequestSequence.current) return;
      setLead(leadData);
      setInteractions(interactionData);
    } catch (err) {
      if (requestId !== leadRequestSequence.current) return;
      setError(err instanceof Error ? err.message : "Não foi possível carregar a oportunidade.");
    } finally {
      if (requestId === leadRequestSequence.current) {
        setLoading(false);
      }
    }
  }, [leadId]);

  useEffect(() => {
    void loadLead();
    return () => {
      leadRequestSequence.current += 1;
    };
  }, [loadLead]);

  async function handleSaveInteraction(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    const currentUser = AuthService.getUser();
    const userId = currentUser?.id || lead.assignedToId || "admin";

    let newStatus: LeadStatus | undefined = undefined;
    let descriptionText = interactionForm.description.trim();

    switch (interactionForm.result) {
      case "CONTACTED":
        newStatus = "CONTACTED";
        if (!descriptionText) descriptionText = "Contato comercial realizado com sucesso.";
        break;
      case "INTERESTED":
        newStatus = "INTERESTED";
        if (!descriptionText) descriptionText = "Cliente demonstrou interesse nos produtos Deusa.";
        break;
      case "NEGOTIATION":
        newStatus = "NEGOTIATION";
        if (!descriptionText) descriptionText = "Negociação comercial iniciada / Proposta enviada.";
        break;
      case "CONVERTED":
        newStatus = "CONVERTED";
        if (!descriptionText)
          descriptionText = "Oportunidade convertida! Cliente ativo cadastrado.";
        break;
      case "NOT_INTERESTED":
        newStatus = "NOT_INTERESTED";
        if (!descriptionText) descriptionText = "Sem interesse comercial no momento.";
        break;
      case "NO_ANSWER":
        if (!descriptionText) descriptionText = "Tentativa de contato realizada - sem resposta.";
        break;
    }

    try {
      await leadsService.createInteraction(lead.id, {
        userId,
        type: interactionForm.type,
        description: descriptionText,
        newStatus,
        nextActionAt: interactionForm.nextActionDate
          ? new Date(interactionForm.nextActionDate).toISOString()
          : undefined,
      });

      toast.success("Interação registrada e status comercial atualizado!");
      setShowInteractionModal(false);
      setInteractionForm({
        type: "Ligação comercial",
        result: "CONTACTED",
        description: "",
        nextActionDate: "",
      });
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao registrar interação.");
    }
  }

  async function handleSaveVisit(e: React.FormEvent) {
    e.preventDefault();
    if (!lead) return;
    const currentUser = AuthService.getUser();
    const userId = currentUser?.id || lead.assignedToId || "admin";

    if (!visitForm.date) {
      toast.error("Selecione a data da visita presencial.");
      return;
    }

    try {
      await leadsService.createInteraction(lead.id, {
        userId,
        type: "Visita presencial agendada",
        description: `Visita comercial planejada para ${new Date(visitForm.date).toLocaleDateString("pt-BR")}. ${visitForm.notes ? `Obs: ${visitForm.notes}` : ""}`,
        newStatus: "NEGOTIATION",
        nextActionAt: new Date(visitForm.date).toISOString(),
      });

      toast.success("Visita presencial planejada e adicionada ao funil!");
      setShowVisitModal(false);
      setVisitForm({ date: "", notes: "" });
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao agendar visita.");
    }
  }

  if (loading) return <LoadingState message="Carregando detalhes da oportunidade comercial..." />;

  if (error) {
    return (
      <div>
        <PageHeader
          title="Erro ao carregar oportunidade"
          subtitle="Não foi possível buscar os dados no backend."
        />
        <ErrorState
          description={error}
          action={
            <button
              onClick={loadLead}
              className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
            >
              Tentar novamente
            </button>
          }
        />
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
        <PageHeader
          title="Oportunidade não encontrada"
          subtitle="O registro solicitado não existe no sistema."
        />
        <EmptyState
          title="Lead indisponível"
          description="Volte para a lista de leads B2B e selecione uma oportunidade válida."
          action={
            <Link
              to="/leads-b2b"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar para leads
            </Link>
          }
        />
      </div>
    );
  }

  const company = lead.company;
  const isRealCnpj =
    /^\d{14}$/.test(company.cnpj.replace(/\D/g, "")) &&
    !company.cnpj.startsWith("G-") &&
    !company.cnpj.startsWith("GOOGLE-");
  const phone = company.details?.telefone || company.telefoneEncontrado || company.telefone || null;
  const email = company.details?.email || company.email || null;
  const website = null;

  const phoneDigits = phone ? phone.replace(/\D/g, "") : "";
  const waUrl =
    phoneDigits.length >= 10
      ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(`Olá, gostaria de apresentar as soluções comerciais da Deusa Alimentos para o ${companyName(company)}.`)}`
      : null;
  const telUrl = phone ? `tel:${phoneDigits}` : null;
  const mailUrl = email ? `mailto:${email}` : null;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${companyName(company)}, ${company.logradouro || ""} ${company.numero || ""}, ${company.cidade}/${company.uf}`)}`;

  const scoreColor =
    lead.score >= 80 ? "text-[#ED1C24]" : lead.score >= 65 ? "text-[#C2410C]" : "text-[#1061AF]";
  const levelBadgeClass =
    lead.potentialLevel === "CRITICAL"
      ? "bg-red-50 text-red-700 border-red-200"
      : lead.potentialLevel === "HIGH"
        ? "bg-amber-50 text-amber-800 border-amber-200"
        : "bg-blue-50 text-blue-800 border-blue-200";

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#1061AF]">
              Oportunidade Comercial
            </span>
            <span
              className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase ${levelBadgeClass}`}
            >
              {potentialLabels[lead.potentialLevel]}
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#0B1F33]">
            {companyName(company)}
          </h1>
          <p className="mt-0.5 text-sm text-[#64748B]">
            {company.cidade}/{company.uf} · CNAE {formatCnae(company.cnaePrincipal)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/leads-b2b"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Leads
          </Link>
          <button
            onClick={handleOpenEditModal}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-white px-3.5 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
          >
            <Pencil className="h-3.5 w-3.5 text-[#1061AF]" />
            Editar cadastro
          </button>
          <button
            onClick={() => setShowInteractionModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF]"
          >
            <PhoneCall className="h-4 w-4 text-[#FFF200]" />
            Registrar contato
          </button>
        </div>
      </div>

      {/* ── Seção Superior: Identificação e Oportunidade ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Card 1: Identificação Cadastral */}
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between border-b border-[#E2E8F0] pb-4">
            <div>
              <h2 className="text-base font-bold text-[#0B1F33]">Identificação da Empresa</h2>
              <p className="text-xs text-[#64748B]">{company.razaoSocial}</p>
            </div>
            {isRealCnpj && (
              <span className="inline-flex items-center rounded-md bg-[#F1F5F9] px-2.5 py-1 text-xs font-bold text-[#0B1F33]">
                CNPJ {formatCnpj(company.cnpj)}
              </span>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Cidade / UF
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#0B1F33]">
                {company.cidade}/{company.uf}
              </span>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Bairro
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#0B1F33]">
                {company.bairro || "-"}
              </span>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Endereço
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#0B1F33]">
                {company.logradouro ? `${company.logradouro}, ${company.numero || "S/N"}` : "-"}
              </span>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                CNAE Principal
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#0B1F33]">
                {formatCnae(company.cnaePrincipal)}
              </span>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Porte
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#0B1F33]">
                {company.porte || "-"}
              </span>
            </div>
            <div className="rounded-lg bg-[#F8FAFC] p-3">
              <span className="block text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                Situação Cadastral
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-emerald-700">
                {company.situacaoCadastral}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Pontuação da Oportunidade */}
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="text-base font-bold text-[#0B1F33]">Pontuação & Potencial</h2>
              <span className="text-xs font-bold text-[#64748B]">Score Deusa</span>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0B1F33] p-2 text-center text-white shadow-sm">
                <div>
                  <span className="block text-[9px] font-bold uppercase text-[#FFF200]">Score</span>
                  <span className="text-2xl font-bold tabular-nums">{lead.score}</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-[#64748B]">Classificação</div>
                <div className={`text-base font-bold ${scoreColor}`}>
                  {potentialLabels[lead.potentialLevel]} Potencial ({lead.score}/100)
                </div>
                <div className="mt-0.5 text-xs text-[#475569]">
                  Etapa atual:{" "}
                  <strong className="text-[#0B1F33]">{statusLabels[lead.status]}</strong>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-1.5 border-t border-[#E2E8F0] pt-3">
              <div className="text-[11px] font-bold uppercase text-[#64748B]">
                Responsável Atual
              </div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0B1F33]">
                <UserCheck className="h-4 w-4 text-[#1061AF]" />
                {lead.assignedTo?.name || "Não atribuído"}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#E2E8F0]">
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] py-2 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF]"
            >
              <Navigation className="h-3.5 w-3.5 text-[#1061AF]" />
              Ver localização no Google Maps
            </a>
          </div>
        </div>
      </div>

      {/* ── Seção de Contatos Disponíveis (Canais Reais) ── */}
      <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-[#0B1F33]">Contatos & Ações Comerciais</h2>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Utilize os canais abaixo para abordagem comercial direta ou agendamento de visita
          presencial.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Canal WhatsApp */}
          <div
            className={`rounded-xl border p-4 transition ${waUrl ? "border-emerald-200 bg-emerald-50/40" : "border-[#E2E8F0] bg-[#F8FAFC] opacity-60"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#0B1F33]">WhatsApp</span>
              <MessageSquare
                className={`h-4 w-4 ${waUrl ? "text-emerald-600" : "text-[#94A3B8]"}`}
              />
            </div>
            <div className="mt-2 text-xs font-semibold text-[#0B1F33]">
              {phone || "Não cadastrado"}
            </div>
            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#16A34A] text-xs font-bold text-white transition hover:bg-emerald-700"
              >
                Iniciar conversa no WhatsApp
              </a>
            ) : (
              <span className="mt-3 block text-center text-[11px] text-[#64748B]">
                Canal indisponível
              </span>
            )}
          </div>

          {/* Canal Telefone */}
          <div
            className={`rounded-xl border p-4 transition ${telUrl ? "border-blue-200 bg-blue-50/40" : "border-[#E2E8F0] bg-[#F8FAFC] opacity-60"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#0B1F33]">Telefone / Ligação</span>
              <Phone className={`h-4 w-4 ${telUrl ? "text-[#1061AF]" : "text-[#94A3B8]"}`} />
            </div>
            <div className="mt-2 text-xs font-semibold text-[#0B1F33]">
              {phone || "Não cadastrado"}
            </div>
            {telUrl ? (
              <a
                href={telUrl}
                className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1061AF] text-xs font-bold text-white transition hover:bg-[#0B1F33]"
              >
                Fazer ligação
              </a>
            ) : (
              <span className="mt-3 block text-center text-[11px] text-[#64748B]">
                Canal indisponível
              </span>
            )}
          </div>

          {/* Canal E-mail */}
          <div
            className={`rounded-xl border p-4 transition ${mailUrl ? "border-sky-200 bg-sky-50/40" : "border-[#E2E8F0] bg-[#F8FAFC] opacity-60"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#0B1F33]">E-mail Comercial</span>
              <Mail className={`h-4 w-4 ${mailUrl ? "text-sky-600" : "text-[#94A3B8]"}`} />
            </div>
            <div className="mt-2 truncate text-xs font-semibold text-[#0B1F33]">
              {email || "Não cadastrado"}
            </div>
            {mailUrl ? (
              <a
                href={mailUrl}
                className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-sky-700 text-xs font-bold text-white transition hover:bg-sky-800"
              >
                Enviar e-mail
              </a>
            ) : (
              <span className="mt-3 block text-center text-[11px] text-[#64748B]">
                Canal indisponível
              </span>
            )}
          </div>

          {/* Ação Planejar Visita Presencial */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-[#0B1F33]">Visita Presencial</span>
              <MapPin className="h-4 w-4 text-amber-700" />
            </div>
            <div className="mt-2 text-xs font-semibold text-[#0B1F33]">Abordagem em campo</div>
            <button
              onClick={() => setShowVisitModal(true)}
              className="mt-3 inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0B1F33] text-xs font-bold text-white transition hover:bg-[#1061AF]"
            >
              Planejar visita
            </button>
          </div>
        </div>
      </section>

      {/* ── Próxima Ação & Histórico de Interações ── */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Card Próxima Ação */}
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="text-base font-bold text-[#0B1F33]">Próxima Ação</h2>
              <CalendarClock className="h-4 w-4 text-[#1061AF]" />
            </div>

            <div className="mt-4 rounded-xl border border-[#FFF200]/80 bg-[#FFFBEB] p-4">
              <div className="text-xs font-bold uppercase text-amber-900">
                Agendamento Comercial
              </div>
              <div className="mt-1 text-sm font-bold text-[#0B1F33]">
                {lead.nextActionAt
                  ? formatDateTime(lead.nextActionAt)
                  : "Sem próxima ação definida"}
              </div>
              <p className="mt-1 text-xs text-[#64748B]">
                Último contato registrado: {formatDateTime(lead.lastContactAt)}
              </p>
            </div>
          </div>

          <div className="mt-4 space-y-2 pt-3 border-t border-[#E2E8F0]">
            <button
              onClick={() => setShowInteractionModal(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F33] py-2 text-xs font-bold text-white transition hover:bg-[#1061AF]"
            >
              <PhoneCall className="h-3.5 w-3.5 text-[#FFF200]" />
              Registrar novo resultado
            </button>
          </div>
        </div>

        {/* Histórico Comercial */}
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
            <h2 className="text-base font-bold text-[#0B1F33]">
              Histórico Comercial de Interações
            </h2>
            <span className="text-xs font-bold text-[#64748B]">
              {interactions.length} registro(s)
            </span>
          </div>

          <div className="mt-4 space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {interactions.length === 0 ? (
              <EmptyState
                title="Sem interações registradas"
                description="Abra uma conversa ou registe o primeiro contato para iniciar o histórico comercial."
              />
            ) : (
              interactions.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#DDE5EF] bg-[#F8FAFC] p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#0B1F33]">{item.type}</span>
                    <span className="text-[11px] text-[#64748B]">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-[#475569]">{item.description}</p>
                  {item.user && (
                    <div className="mt-2 text-[10px] font-semibold text-[#64748B]">
                      Registrado por: {item.user.name}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Seção de Qualidade dos Dados ── */}
      <section className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-[#0B1F33]">Verificação e Integridade Cadastral</h2>
        <p className="mt-0.5 text-xs text-[#64748B]">
          Qualidade dos dados e transparência das coordenadas no mapa.
        </p>

        <AvisoLocalizacaoAproximada origemCoordenada={company.origemCoordenada} className="mt-3" />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg bg-[#F8FAFC] p-3">
            <span className="block text-[10px] font-bold uppercase text-[#64748B]">
              Confiança Cadastral
            </span>
            <div className="mt-1 flex items-center justify-between">
              <ConfiancaBadge confianca={company.confiancaVerificacao} />
            </div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-3">
            <span className="block text-[10px] font-bold uppercase text-[#64748B]">
              Status Verificação
            </span>
            <div className="mt-1 flex items-center justify-between">
              <StatusVerificacaoBadge status={company.statusVerificacaoEndereco} />
            </div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-3">
            <span className="block text-[10px] font-bold uppercase text-[#64748B]">Pendência</span>
            <div className="mt-1 flex items-center justify-between">
              <PendenteBadge pendente={company.pendenteValidacao} />
            </div>
          </div>
          <div className="rounded-lg bg-[#F8FAFC] p-3">
            <span className="block text-[10px] font-bold uppercase text-[#64748B]">
              Origem da Coordenada
            </span>
            <span className="mt-1 block text-xs font-semibold text-[#0B1F33]">
              {company.origemCoordenada || "Receita Federal"}
            </span>
          </div>
        </div>
      </section>

      {/* ── MODAL 1: Registrar Interação Comercial ── */}
      {showInteractionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#DDE5EF] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#0B1F33]">Registrar Interação Comercial</h3>
              <button
                onClick={() => setShowInteractionModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveInteraction} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Tipo de Contato
                </label>
                <select
                  value={interactionForm.type}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({ ...prev, type: e.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                >
                  <option>Ligação comercial</option>
                  <option>Mensagem de WhatsApp</option>
                  <option>Visita presencial</option>
                  <option>Reunião comercial</option>
                  <option>E-mail comercial</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Resultado / Etapa do Funil
                </label>
                <select
                  value={interactionForm.result}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({ ...prev, result: e.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs font-bold text-[#0B1F33] outline-none focus:border-[#1061AF]"
                >
                  <option value="CONTACTED">Contato realizado (Mover para Contatado)</option>
                  <option value="INTERESTED">Demonstrou interesse (Mover para Interessado)</option>
                  <option value="NEGOTIATION">Em negociação / Proposta enviada</option>
                  <option value="CONVERTED">Convertido (Cliente Ativo)</option>
                  <option value="NO_ANSWER">Tentativa realizada (Sem resposta)</option>
                  <option value="NOT_INTERESTED">Sem interesse no momento</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Próxima Ação (Data / Hora)
                </label>
                <input
                  type="datetime-local"
                  value={interactionForm.nextActionDate}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({ ...prev, nextActionDate: e.target.value }))
                  }
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Observações do Vendedor
                </label>
                <textarea
                  rows={3}
                  value={interactionForm.description}
                  onChange={(e) =>
                    setInteractionForm((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Detalhe o que foi conversado ou combinado..."
                  className="mt-1.5 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInteractionModal(false)}
                  className="h-9 rounded-lg border border-[#DDE5EF] px-4 text-xs font-bold text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF]"
                >
                  Salvar Interação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 2: Planejar Visita Presencial ── */}
      {showVisitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-[#DDE5EF] bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h3 className="text-base font-bold text-[#0B1F33]">Planejar Visita Presencial</h3>
              <button
                onClick={() => setShowVisitModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveVisit} className="mt-4 space-y-4">
              <div className="rounded-lg bg-[#F8FAFC] p-3 border border-[#E2E8F0]">
                <div className="text-[11px] font-bold text-[#64748B]">Destino da Visita:</div>
                <div className="text-xs font-bold text-[#0B1F33]">{companyName(company)}</div>
                <div className="text-[11px] text-[#64748B]">
                  {company.logradouro
                    ? `${company.logradouro}, ${company.numero || "S/N"}`
                    : company.cidade}{" "}
                  · {company.cidade}/{company.uf}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Data e Hora Planejada
                </label>
                <input
                  type="datetime-local"
                  required
                  value={visitForm.date}
                  onChange={(e) => setVisitForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Observações da Rota / Visita
                </label>
                <textarea
                  rows={3}
                  value={visitForm.notes}
                  onChange={(e) => setVisitForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Falar com o comprador de mercearia no período da manhã..."
                  className="mt-1.5 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowVisitModal(false)}
                  className="h-9 rounded-lg border border-[#DDE5EF] px-4 text-xs font-bold text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF]"
                >
                  Agendar Visita
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL 3: Editar Cadastro do Mercado ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-[#DDE5EF] bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <div>
                <h3 className="text-base font-bold text-[#0B1F33]">Editar Cadastro do Mercado</h3>
                <p className="text-xs text-[#64748B]">
                  Atualize manualmente telefone, e-mail e dados de localização.
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-[#64748B] hover:bg-[#F1F5F9]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompanyDetails} className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Telefone Principal
                  </label>
                  <input
                    type="text"
                    placeholder="(16) 99999-9999"
                    value={editForm.telefone}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, telefone: e.target.value }))}
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    E-mail Comercial
                  </label>
                  <input
                    type="email"
                    placeholder="comercial@mercado.com.br"
                    value={editForm.email}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Nome Fantasia
                  </label>
                  <input
                    type="text"
                    placeholder="Supermercado Exemplo"
                    value={editForm.nomeFantasia}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, nomeFantasia: e.target.value }))
                    }
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    placeholder="Razão Social LTDA"
                    value={editForm.razaoSocial}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, razaoSocial: e.target.value }))
                    }
                    className="mt-1.5 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                  />
                </div>
              </div>

              <div className="border-t border-[#E2E8F0] pt-3">
                <span className="block text-xs font-bold uppercase tracking-wide text-[#0B1F33]">
                  Endereço & Localização
                </span>

                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-[#64748B]">
                      Logradouro / Rua
                    </label>
                    <input
                      type="text"
                      value={editForm.logradouro}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, logradouro: e.target.value }))
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B]">Número</label>
                    <input
                      type="text"
                      value={editForm.numero}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, numero: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    />
                  </div>
                </div>

                <div className="mt-2 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B]">Bairro</label>
                    <input
                      type="text"
                      value={editForm.bairro}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, bairro: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B]">Cidade</label>
                    <input
                      type="text"
                      value={editForm.cidade}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, cidade: e.target.value }))}
                      className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[#64748B]">UF</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={editForm.uf}
                      onChange={(e) =>
                        setEditForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase() }))
                      }
                      className="mt-1 h-9 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-xs text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="h-9 rounded-lg border border-[#DDE5EF] px-4 text-xs font-bold text-[#64748B] hover:bg-[#F1F5F9]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-[#0B1F33] px-4 text-xs font-bold text-white transition hover:bg-[#1061AF]"
                >
                  Salvar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
