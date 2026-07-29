import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";

export function LoadingState({ message = "Carregando dados..." }: { message?: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-[#DDE5EF] bg-white p-8 text-center shadow-sm">
      <div>
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#1061AF]" />
        <p className="mt-3 text-sm font-semibold text-[#0B1F33]">{message}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title = "Nenhum dado encontrado",
  description = "Ajuste os filtros ou importe novos registros para iniciar a análise.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[#C8D4E3] bg-white p-8 text-center shadow-sm">
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-[#F1F5F9]">
          <Inbox className="h-6 w-6 text-[#64748B]" />
        </div>
        <h3 className="mt-4 text-base font-bold text-[#0B1F33]">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-[#64748B]">{description}</p>
        {action && <div className="mt-4 flex justify-center">{action}</div>}
      </div>
    </div>
  );
}

export function ErrorState({
  title = "Não foi possível carregar os dados",
  description = "Tente novamente em alguns instantes. Se o problema persistir, acione o time responsável.",
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-5 text-[#7F1D1D] shadow-sm">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#ED1C24]" />
        <div>
          <h3 className="text-sm font-bold">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#991B1B]">{description}</p>
          {action && <div className="mt-3">{action}</div>}
        </div>
      </div>
    </div>
  );
}

export function SkeletonMetricCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="rounded-xl border border-[#DDE5EF] bg-white p-5 shadow-sm">
          <div className="h-7 w-20 animate-pulse rounded bg-[#E2E8F0]" />
          <div className="mt-4 h-4 w-32 animate-pulse rounded bg-[#EEF2F7]" />
          <div className="mt-2 h-3 w-44 animate-pulse rounded bg-[#EEF2F7]" />
        </div>
      ))}
    </div>
  );
}
