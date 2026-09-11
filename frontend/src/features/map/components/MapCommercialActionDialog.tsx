import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/commercial-formatters";
import { leadsService } from "@/services/leadsService";
import {
  COMMERCIAL_ACTION_LABELS,
  COMMERCIAL_ACTION_TYPES,
  commercialActionLabel,
} from "@/types/commercialAction";
import type { CommercialActionType } from "@/types/commercialAction";
import type { LeadInteraction } from "@/types/lead";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { CalendarClock, Loader2, MessageSquarePlus } from "lucide-react";

type MapCommercialActionDialogProps = {
  point: MapOpportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MapCommercialActionDialog({
  point,
  open,
  onOpenChange,
}: MapCommercialActionDialogProps) {
  const [type, setType] = useState<CommercialActionType>("VISITA");
  const [description, setDescription] = useState("");
  const [scheduleFollowUp, setScheduleFollowUp] = useState(false);
  const [nextContactAt, setNextContactAt] = useState("");
  const [history, setHistory] = useState<LeadInteraction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !point) return;
    let cancelled = false;
    setType("VISITA");
    setDescription("");
    setScheduleFollowUp(false);
    setNextContactAt("");
    setHistory([]);
    setError(null);
    setLoadingHistory(true);

    void leadsService
      .getInteractions(point.id)
      .then((items) => {
        if (!cancelled) setHistory(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, point]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!point) return;

    setSaving(true);
    setError(null);
    if (scheduleFollowUp && !nextContactAt) {
      setError("Informe a data e o horário do próximo contato.");
      setSaving(false);
      return;
    }
    try {
      const parsedNextContact = scheduleFollowUp ? new Date(nextContactAt) : null;
      if (parsedNextContact && Number.isNaN(parsedNextContact.getTime())) {
        throw new Error("Informe uma data e um horário válidos para o próximo contato.");
      }
      const created = await leadsService.createCommercialAction(point.id, {
        type,
        description: description.trim() || undefined,
        nextContactAt: parsedNextContact?.toISOString(),
      });
      setHistory((current) => [created, ...current]);
      setDescription("");
      setScheduleFollowUp(false);
      setNextContactAt("");
      toast.success("Ação comercial registrada no histórico.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível registrar a ação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(680px,calc(100vh-1rem))] w-[calc(100%-1rem)] overflow-y-auto border-[#DDE5EF] bg-white p-4 text-[#0B1F33] sm:max-w-lg sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-[#0B1F33]">
            <MessageSquarePlus className="h-5 w-5 text-[#1061AF]" />
            Registrar ação comercial
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            {point
              ? `${point.companyName} — ${point.city}/${point.uf}`
              : "Estabelecimento selecionado"}
          </DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#64748B]">
              Tipo da ação
            </span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as CommercialActionType)}
              className="h-11 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF] focus:ring-2 focus:ring-[#1061AF]/15"
              required
            >
              {COMMERCIAL_ACTION_TYPES.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {COMMERCIAL_ACTION_LABELS[actionType]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#64748B]">
              Observação <span className="font-normal normal-case">(opcional)</span>
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Ex.: Conversamos com o gerente de compras."
              className="w-full resize-y rounded-lg border border-[#DDE5EF] bg-white px-3 py-2.5 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF] focus:ring-2 focus:ring-[#1061AF]/15"
            />
            <span className="mt-1 block text-right text-[11px] text-[#94A3B8]">
              {description.length}/2000
            </span>
          </label>

          <div className="rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] p-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#0B1F33]">
              <input
                type="checkbox"
                checked={scheduleFollowUp}
                onChange={(event) => setScheduleFollowUp(event.target.checked)}
                className="h-4 w-4 accent-[#1061AF]"
              />
              <CalendarClock className="h-4 w-4 text-[#1061AF]" />
              Agendar próximo contato
            </label>
            {scheduleFollowUp && (
              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#64748B]">
                  Data e horário
                </span>
                <input
                  type="datetime-local"
                  value={nextContactAt}
                  onChange={(event) => setNextContactAt(event.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="h-11 w-full rounded-lg border border-[#DDE5EF] bg-white px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF] focus:ring-2 focus:ring-[#1061AF]/15"
                  required
                />
              </label>
            )}
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !point}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin text-[#FFF200]" />}
            {saving ? "Salvando..." : "Salvar ação"}
          </button>
        </form>

        <section className="border-t border-[#EEF2F7] pt-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-[#64748B]">
            Histórico comercial
          </h3>
          {loadingHistory ? (
            <div className="flex items-center gap-2 text-xs text-[#64748B]">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico...
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs italic text-[#94A3B8]">Nenhuma ação registrada.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <article
                  key={item.id}
                  className="rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <strong className="text-[#0B1F33]">{commercialActionLabel(item.type)}</strong>
                    <time className="text-[11px] text-[#64748B]">
                      {formatDateTime(item.createdAt)}
                    </time>
                  </div>
                  <div className="mt-1 text-[11px] font-semibold text-[#1061AF]">
                    {item.user?.name || item.userLegacy?.name || "Usuário autenticado"}
                  </div>
                  {item.description && (
                    <p className="mt-1 whitespace-pre-wrap break-words text-xs text-[#475569]">
                      {item.description}
                    </p>
                  )}
                  {item.nextContactAt && !item.followUpCompletedAt && (
                    <p className="mt-2 text-[11px] font-semibold text-[#1061AF]">
                      Próximo contato: {formatDateTime(item.nextContactAt)}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
