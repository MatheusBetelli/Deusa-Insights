import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MapOpportunity } from "@/types/mapOpportunity";
import { Loader2, MapPin } from "lucide-react";

type CoordinatePair = {
  latitude: number;
  longitude: number;
};

type MapLocationAdjustmentDialogProps = {
  point: MapOpportunity | null;
  previous: CoordinatePair | null;
  pending: CoordinatePair | null;
  open: boolean;
  saving: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

function formatCoordinate(value: number) {
  return value.toFixed(6);
}

export function MapLocationAdjustmentDialog({
  point,
  previous,
  pending,
  open,
  saving,
  onOpenChange,
  onConfirm,
  onCancel,
}: MapLocationAdjustmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : onCancel())}>
      <DialogContent className="w-[calc(100%-1rem)] border-[#DDE5EF] bg-white p-4 text-[#0B1F33] sm:max-w-md sm:p-6">
        <DialogHeader className="pr-6 text-left">
          <DialogTitle className="flex items-center gap-2 text-[#0B1F33]">
            <MapPin className="h-5 w-5 text-[#1061AF]" />
            Confirmar localização
          </DialogTitle>
          <DialogDescription className="text-xs text-[#64748B]">
            {point?.companyName || "Estabelecimento selecionado"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
            Confirmar alteração da localização deste estabelecimento? A nova posição será salva
            manualmente e ficará registrada na auditoria.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-[#EEF2F7] bg-[#F8FAFC] p-3">
              <div className="text-[10px] font-bold uppercase text-[#94A3B8]">Anterior</div>
              <div className="mt-1 font-mono text-xs text-[#475569]">
                {previous
                  ? `${formatCoordinate(previous.latitude)}, ${formatCoordinate(previous.longitude)}`
                  : "Não informado"}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
              <div className="text-[10px] font-bold uppercase text-[#1061AF]">Nova</div>
              <div className="mt-1 font-mono text-xs text-[#0B1F33]">
                {pending
                  ? `${formatCoordinate(pending.latitude)}, ${formatCoordinate(pending.longitude)}`
                  : "Mova o pino no mapa"}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-11 rounded-lg border border-[#DDE5EF] bg-white px-4 text-sm font-semibold text-[#475569] transition hover:bg-[#F8FAFC] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || !pending}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0B1F33] px-4 text-sm font-bold text-white transition hover:bg-[#1061AF] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin text-[#FFF200]" />}
            {saving ? "Salvando..." : "Salvar localização"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
