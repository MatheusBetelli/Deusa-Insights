import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationBarProps = {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  label?: string;
};

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  label = "resultados",
}: PaginationBarProps) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-col gap-3 border-t border-[#DDE5EF] px-4 py-3 text-xs font-medium text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
      <span>
        {start}-{end} de {total} {label}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-3 font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </button>
        <span className="min-w-20 text-center">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          disabled={page === totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-[#DDE5EF] bg-white px-3 font-bold text-[#0B1F33] transition hover:border-[#1061AF] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Próxima
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
