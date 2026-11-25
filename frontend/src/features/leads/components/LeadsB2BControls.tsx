import { ArrowDownUp } from "lucide-react";
import type { ReactNode } from "react";

export function MetricCard({
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
    <div className="relative flex min-h-[76px] items-center justify-between gap-3 overflow-hidden rounded-lg border border-[#DDE5EF] bg-white px-4 py-3 shadow-2xs">
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
export function FilterSelect({
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
        className={`${compact ? "h-9 text-xs" : "h-10 text-sm"} w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white`}
      >
        {children}
      </select>
    </label>
  );
}
export function SortButton({
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
      className="inline-flex items-center gap-1 hover:text-[#0B1F33] cursor-pointer"
    >
      {children}
      <ArrowDownUp className={`h-3.5 w-3.5 ${active ? "text-[#1061AF]" : "text-[#CBD5E1]"}`} />
      {active && <span className="text-[10px] lowercase text-[#1061AF]">{order}</span>}
    </button>
  );
}
