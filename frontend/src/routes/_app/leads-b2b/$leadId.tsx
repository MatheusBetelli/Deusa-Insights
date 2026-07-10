import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
import {
  AvisoLocalizacaoAproximada,
  ConfiancaBadge,
  NivelOportunidadeBadge,
  PendenteBadge,
  SituacaoCadastralBadge,
  StatusVerificacaoBadge,
} from "@/components/app/QualityBadges";
import { companyName, formatCnae, formatCnpj, formatDateTime, potentialLabels, statusLabels } from "@/lib/commercial-formatters";
import { leadsService } from "@/services/leadsService";
import type { Lead, LeadInteraction } from "@/types/lead";
import { ArrowLeft, CalendarClock, CheckCircle2, MapPin, PhoneCall, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/leads-b2b/$leadId")({
  component: LeadDetail,
});

function LeadDetail() {
  const { leadId } = Route.useParams();
  const [lead, setLead] = useState<Lead | null>(null);
  const [interactions, setInteractions] = useState<LeadInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLead() {
    setLoading(true);
    setError(null);
    try {
      const [leadData, interactionData] = await Promise.all([
        leadsService.getLead(leadId),
        leadsService.getInteractions(leadId),
      ]);
      setLead(leadData);
      setInteractions(interactionData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o lead.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLead();
  }, [leadId]);

  async function registerContact() {
    if (!lead?.assignedToId) {
      toast.error("Lead sem responsável para registrar contato.");
      return;
    }
    await leadsService.createInteraction(lead.id, {
      userId: lead.assignedToId,
      type: "Contato comercial",
      description: "Contato registrado no detalhe do lead.",
    });
    toast.success("Contato registrado.");
    loadLead();
  }

  async function scheduleNextAction() {
    if (!lead) return;
    const nextActionAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await leadsService.updateLead(lead.id, { nextActionAt });
    toast.success("Próxima ação agendada para 7 dias.");
    loadLead();
  }

  async function convertLead() {
    if (!lead) return;
    await leadsService.convertLead(lead.id);
    toast.success("Oportunidade convertida em cliente.");
    loadLead();
  }

  async function discardLead() {
    if (!lead) return;
    await leadsService.discardLead(lead.id);
    toast.warning("Oportunidade descartada.");
    loadLead();
  }

  if (loading) return <LoadingState message="Carregando detalhe do lead..." />;

  if (error) {
    return (
      <div>
        <PageHeader title="Erro ao carregar lead" subtitle="Não foi possível buscar o registro no backend." />
        <ErrorState description={error} action={<button onClick={loadLead} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} />
      </div>
    );
  }

  if (!lead) {
    return (
      <div>
        <PageHeader title="Lead não encontrado" subtitle="O registro solicitado não existe nos dados atuais." />
        <EmptyState title="Lead indisponível" description="Volte para a lista de leads B2B e selecione uma oportunidade válida." action={<Link to="/leads-b2b" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white"><ArrowLeft className="h-4 w-4" />Voltar para leads</Link>} />
      </div>
    );
  }

  const company = lead.company;

  return (
    <div>
      <PageHeader
        title={companyName(company)}
        subtitle={`${company.cidade}/${company.uf} · ${formatCnae(company.cnaePrincipal)}`}
        actions={<Link to="/leads-b2b" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-bold text-[#0B1F33] hover:border-[#1061AF]"><ArrowLeft className="h-4 w-4" />Voltar</Link>}
      />

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#0B1F33]">Dados cadastrais</h2>
              <p className="mt-1 text-sm text-[#64748B]">{company.razaoSocial}</p>
            </div>
            <div className="rounded-lg bg-[#0B1F33] px-4 py-3 text-center text-white">
              <div className="text-xs font-bold uppercase text-[#FFF200]">Score</div>
              <div className="text-3xl font-bold tabular-nums">{lead.score}</div>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              ["CNPJ", formatCnpj(company.cnpj)],
              ["Cidade", `${company.cidade}/${company.uf}`],
              ["Bairro", company.bairro ?? "-"],
              ["Endereço", `${company.logradouro ?? ""}, ${company.numero ?? ""}`.trim() || "-"],
              ["CNAE", formatCnae(company.cnaePrincipal)],
              ["Porte", company.porte ?? "-"],
              ["CEP", company.cep ?? "-"],
              ["Situação", company.situacaoCadastral],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg bg-[#F8FAFC] p-3">
                <div className="text-[11px] font-bold uppercase text-[#64748B]">{label}</div>
                <div className="mt-1 text-sm font-semibold text-[#0B1F33]">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#0B1F33]">Dados comerciais</h2>
          <div className="mt-4 grid gap-3">
            {[
              ["Status", statusLabels[lead.status]],
              ["Prioridade", potentialLabels[lead.potentialLevel]],
              ["Responsável", lead.assignedTo?.name ?? "Sem responsável"],
              ["Último contato", formatDateTime(lead.lastContactAt)],
              ["Próxima ação", formatDateTime(lead.nextActionAt)],
              ["Observações", lead.notes ?? "-"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 rounded-lg border border-[#DDE5EF] px-3 py-2">
                <span className="text-xs font-bold uppercase text-[#64748B]">{label}</span>
                <span className="text-right text-sm font-semibold text-[#0B1F33]">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#0B1F33]">Próxima ação</h2>
          <div className="mt-4 rounded-lg border border-[#FFF200]/70 bg-[#FFFBEB] p-4">
            <div className="text-sm font-bold text-[#0B1F33]">{lead.nextActionAt ? `Acompanhar em ${formatDateTime(lead.nextActionAt)}` : "Definir próxima ação comercial"}</div>
            <p className="mt-1 text-sm leading-relaxed text-[#64748B]">Último contato: {formatDateTime(lead.lastContactAt)}</p>
          </div>
          <div className="mt-4 grid gap-2">
            <button onClick={registerContact} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white hover:bg-[#1061AF]"><PhoneCall className="h-4 w-4 text-[#FFF200]" />Registrar contato</button>
            <button onClick={scheduleNextAction} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-bold text-[#0B1F33] hover:border-[#1061AF]"><CalendarClock className="h-4 w-4 text-[#1061AF]" />Agendar próxima ação</button>
            <button onClick={convertLead} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-bold text-[#0B1F33] hover:border-[#1061AF]"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Converter em cliente</button>
            <button onClick={discardLead} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-4 text-sm font-bold text-[#B91C1C]"><Trash2 className="h-4 w-4" />Descartar oportunidade</button>
          </div>
        </div>

        <div className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[#0B1F33]">Histórico de contato</h2>
          <div className="mt-4 space-y-3">
            {interactions.length === 0 ? (
              <EmptyState title="Sem interações" description="Registre o primeiro contato comercial para iniciar o histórico." />
            ) : (
              interactions.map((item) => (
                <div key={item.id} className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-bold text-[#0B1F33]">{item.type}</div>
                    <div className="text-xs font-semibold text-[#64748B]">{formatDateTime(item.createdAt)}</div>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">{item.description}</p>
                  {item.user && <p className="mt-2 text-xs font-semibold text-[#64748B]">{item.user.name}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Seção de Qualidade e Verificação */}
      <section className="mt-5 rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#0B1F33]">Qualidade e Verificação</h2>
        <p className="mt-1 text-xs text-[#64748B]">
          Avaliação da integridade dos dados cadastrais obtidos da Receita Federal.
        </p>

        {/* Aviso de localização aproximada — exibido apenas quando a coordenada for centroide/jitter */}
        <AvisoLocalizacaoAproximada origemCoordenada={company.origemCoordenada} className="mt-4" />

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {/* Coluna esquerda: dados de confiança */}
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold uppercase text-[#64748B]">Confiança Cadastral</span>
              <ConfiancaBadge confianca={company.confiancaVerificacao} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold uppercase text-[#64748B]">Status Verificação</span>
              <StatusVerificacaoBadge status={company.statusVerificacaoEndereco} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold uppercase text-[#64748B]">Oportunidade</span>
              <NivelOportunidadeBadge nivel={company.nivelOportunidade} />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold uppercase text-[#64748B]">Situação</span>
              <SituacaoCadastralBadge situacao={company.situacaoCadastral} />
            </div>
            {(company.origemCoordenada?.includes("centroide") || company.origemCoordenada?.includes("jitter")) && (
              <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
                <span className="text-xs font-bold uppercase text-[#64748B]">Origem Coordenada</span>
                <span className="flex items-center gap-1 text-xs font-semibold text-sky-700">
                  <MapPin className="h-3 w-3" />
                  Centroide municipal
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-[#F8FAFC] px-3 py-2">
              <span className="text-xs font-bold uppercase text-[#64748B]">Pendência</span>
              <PendenteBadge pendente={company.pendenteValidacao} />
              {!company.pendenteValidacao && (
                <span className="text-xs text-[#64748B]">Sem pendências</span>
              )}
            </div>
          </div>

          {/* Coluna direita: motivos */}
          <div className="space-y-3">
            {(company.motivosPendencia?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                <div className="mb-2 text-xs font-bold uppercase text-orange-700">Motivos de Pendência</div>
                <ul className="space-y-1">
                  {company.motivosPendencia!.map((motivo, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-orange-800">
                      <span className="mt-0.5 text-orange-500">•</span>
                      {motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {(company.motivoPontuacao?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-[#64748B]">Pontuação Oportunidade</span>
                  <span className="text-sm font-bold text-[#0B1F33]">{company.pontuacaoOportunidade ?? 0}/100</span>
                </div>
                <ul className="space-y-1">
                  {company.motivoPontuacao!.map((motivo, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-[#475569]">
                      <span className="mt-0.5 text-[#94A3B8]">•</span>
                      {motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
