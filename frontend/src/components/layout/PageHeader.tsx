import type { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  if (!title && !subtitle && !actions) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
      {(title || subtitle) && (
        <div>
          {title && <h1 className="text-3xl font-bold tracking-tight text-[#0B1F33]">{title}</h1>}
          {subtitle && <p className="mt-1.5 text-sm text-[#64748B]">{subtitle}</p>}
        </div>
      )}
      {actions && <div className="flex flex-wrap gap-2 ml-auto">{actions}</div>}
    </div>
  );
}
