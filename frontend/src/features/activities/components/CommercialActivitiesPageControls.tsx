import type { CommercialActivity } from "@/features/activities/types/commercialActivity";
import { COMMERCIAL_ACTION_LABELS } from "@/features/leads/types/commercialAction";
import { formatDateTime } from "@/lib/commercial-formatters";
import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";
export function QuickViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
        active
          ? "border-[#0B1F33] bg-[#0B1F33] text-white"
          : "border-[#DDE5EF] bg-white text-[#475569] hover:border-[#1061AF] hover:text-[#1061AF]"
      }`}
    >
      {children}
    </button>
  );
}
export function ActivityRow({
  activity,
  followUp = false,
  completing = false,
  onComplete,
}: {
  activity: CommercialActivity;
  followUp?: boolean;
  completing?: boolean;
  onComplete?: () => void;
}) {
  const date = followUp ? activity.nextContactAt : activity.createdAt;
  return (
    <tr className="transition hover:bg-[#F8FAFC]">
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="hover:text-[#1061AF]"
        >
          {date ? formatDateTime(date) : "Sem data"}
        </Link>
      </td>
      <td className="max-w-[220px] px-4 py-3 align-top">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="font-bold text-[#0B1F33] hover:text-[#1061AF]"
        >
          {activity.companyName}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">{activity.city}</td>
      <td className="whitespace-nowrap px-4 py-3 align-top">
        <Link
          to="/leads-b2b/$leadId"
          params={{ leadId: activity.leadId }}
          className="font-bold text-[#1061AF] hover:underline"
        >
          {COMMERCIAL_ACTION_LABELS[activity.type] ?? activity.type}
        </Link>
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top font-semibold text-[#475569]">
        {activity.responsibleName || "Não identificado"}
      </td>
      <td className="max-w-[360px] px-4 py-3 align-top leading-relaxed text-[#475569]">
        <span className="line-clamp-2">{activity.description}</span>
        {followUp && onComplete && (
          <button
            type="button"
            onClick={onComplete}
            disabled={completing}
            className="mt-2 rounded-md border border-[#DDE5EF] px-2 py-1 text-[11px] font-bold text-[#1061AF] transition hover:border-[#1061AF] disabled:opacity-50"
          >
            {completing ? "Concluindo..." : "Concluir retorno"}
          </button>
        )}
      </td>
      <td className="whitespace-nowrap px-4 py-3 align-top text-[#475569]">
        {activity.lastContactAt ? formatDateTime(activity.lastContactAt) : "—"}
      </td>
    </tr>
  );
}
export function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "date";
  icon?: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]">
            {icon}
          </span>
        )}
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={`${icon ? "pl-9" : "px-3"} h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pr-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white`}
        />
      </span>
    </label>
  );
}
export function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none transition focus:border-[#1061AF] focus:bg-white"
      >
        {children}
      </select>
    </label>
  );
}
