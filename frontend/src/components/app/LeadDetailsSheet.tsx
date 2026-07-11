import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState, ErrorState, LoadingState } from "@/components/app/InterfaceStates";
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
import { usersService } from "@/services/usersService";
import type { Lead, LeadStatus, UserSummary } from "@/types/lead";
import { Building2, Loader2, MessageSquare, Save } from "lucide-react";

type LeadDetailsSheetProps = {
  leadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function LeadDetailsSheet({ leadId, open, onOpenChange, onUpdated }: LeadDetailsSheetProps) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [assignedToId, setAssignedToId] = useState("");
  const [contactDescription, setContactDescription] = useState("");

  const loadLead = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const [leadData, userData] = await Promise.all([
        leadsService.getLead(leadId),
        usersService.getUsers(),
      ]);
      setLead(leadData);
      setUsers(userData);
      setStatus(leadData.status);
      setAssignedToId(leadData.assignedToId ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o lead.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (open) {
      void loadLead();
    }
  }, [open, loadLead]);

  async function handleSave() {
    if (!lead) return;
    setSaving(true);
    try {
      const updated = await leadsService.updateLead(lead.id, {
        status,
        assignedToId: assignedToId || null,
      });
      setLead((current) =>
        current
          ? {
              ...current,
              ...updated,
              company: current.company,
              interactions: current.interactions,
            }
          : updated,
      );
      toast.success("Lead atualizado.");
      onUpdated?.();
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar o lead.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegisterContact() {
    if (!lead) return;
    if (!assignedToId) {
      toast.error("Atribua um responsável antes de registrar contato.");
      return;
    }

    setSaving(true);
    try {
      await leadsService.createInteraction(lead.id, {
        userId: assignedToId,
        type: "Contato comercial",
        description: contactDescription.trim() || "Contato registrado pelo painel operacional.",
      });
      await leadsService.updateLead(lead.id, {
        assignedToId,
        status: status === "NEW" || status === "NO_CONTACT" ? "CONTACTED" : status,
        lastContactAt: new Date().toISOString(),
      });
      setContactDescription("");
      toast.success("Contato registrado.");
      onUpdated?.();
      await loadLead();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível registrar contato.");
    } finally {
      setSaving(false);
    }
  }

  const company = lead?.company;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-[#DDE5EF] bg-[#F8FAFC] px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-[#0B1F33]">
            <Building2 className="h-5 w-5 text-[#1061AF]" />
            Detalhes do lead
          </SheetTitle>
          <SheetDescription>
            Dados completos e ações comerciais integradas ao backend.
          </SheetDescription>
        </SheetHeader>

        <div className="p-5">
          {loading ? (
            <LoadingState message="Carregando lead..." />
          ) : error ? (
            <ErrorState
              description={error}
              action={
                <button
                  onClick={() => void loadLead()}
                  className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white"
                >
                  Tentar novamente
                </button>
              }
            />
          ) : !lead || !company ? (
            <EmptyState
              title="Lead não selecionado"
              description="Abra um lead para ver os detalhes."
            />
          ) : (
            <div className="space-y-4">
              <section className="rounded-lg border border-[#DDE5EF] bg-white p-4">
                <h2 className="text-lg font-bold leading-tight text-[#0B1F33]">
                  {companyName(company)}
                </h2>
                <p className="mt-1 font-mono text-xs text-[#64748B]">{formatCnpj(company.cnpj)}</p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <Info label="Cidade" value={`${company.cidade}/${company.uf}`} />
                  <Info label="CNAE" value={formatCnae(company.cnaePrincipal)} />
                  <Info label="Situação" value={company.situacaoCadastral} />
                  <Info
                    label="Score"
                    value={`${lead.score} · ${potentialLabels[lead.potentialLevel]}`}
                  />
                  <Info label="Último contato" value={formatDateTime(lead.lastContactAt)} />
                  <Info label="Próxima ação" value={formatDateTime(lead.nextActionAt)} />
                </div>
                <div className="mt-3 rounded-md bg-[#F8FAFC] px-3 py-2 text-sm text-[#475569]">
                  {[company.logradouro, company.numero, company.bairro, company.cep]
                    .filter(Boolean)
                    .join(", ") || "Endereço não informado"}
                </div>
              </section>

              <section className="rounded-lg border border-[#DDE5EF] bg-white p-4">
                <h3 className="text-sm font-bold uppercase text-[#64748B]">Ações comerciais</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[#64748B]">
                      Status comercial
                    </span>
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value as LeadStatus)}
                      className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    >
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[#64748B]">Responsável</span>
                    <select
                      value={assignedToId}
                      onChange={(event) => setAssignedToId(event.target.value)}
                      className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
                    >
                      <option value="">Sem responsável</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white transition hover:bg-[#1061AF] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar alterações
                </button>
              </section>

              <section className="rounded-lg border border-[#DDE5EF] bg-white p-4">
                <h3 className="text-sm font-bold uppercase text-[#64748B]">Registrar contato</h3>
                <textarea
                  value={contactDescription}
                  onChange={(event) => setContactDescription(event.target.value)}
                  rows={3}
                  placeholder="Resumo do contato comercial"
                  className="mt-3 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
                />
                <button
                  onClick={() => void handleRegisterContact()}
                  disabled={saving}
                  className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-[#DDE5EF] bg-white px-3 text-xs font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  Registrar contato
                </button>
              </section>

              <section className="rounded-lg border border-[#DDE5EF] bg-white p-4">
                <h3 className="text-sm font-bold uppercase text-[#64748B]">Histórico</h3>
                <div className="mt-3 space-y-2">
                  {(lead.interactions ?? []).length === 0 ? (
                    <p className="text-sm text-[#94A3B8]">Nenhum contato registrado.</p>
                  ) : (
                    lead.interactions?.map((interaction) => (
                      <div key={interaction.id} className="rounded-md bg-[#F8FAFC] px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-bold text-[#0B1F33]">
                            {interaction.type}
                          </span>
                          <span className="text-xs text-[#64748B]">
                            {formatDateTime(interaction.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#475569]">{interaction.description}</p>
                        {interaction.user && (
                          <p className="mt-1 text-xs font-semibold text-[#64748B]">
                            {interaction.user.name}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#F8FAFC] px-3 py-2">
      <div className="text-[10px] font-bold uppercase text-[#94A3B8]">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-[#0B1F33]">{value}</div>
    </div>
  );
}
