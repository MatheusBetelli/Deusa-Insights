type Props = { level: string; className?: string };

const styles: Record<string, string> = {
  critica: "bg-[#ED1C24]/10 text-[#ED1C24] ring-1 ring-[#ED1C24]/20",
  alta: "bg-[#F97316]/10 text-[#C2410C] ring-1 ring-[#F97316]/20",
  media: "bg-[#1061AF]/10 text-[#0F58A0] ring-1 ring-[#1061AF]/20",
  atencao: "bg-[#FFF200]/30 text-[#854D0E] ring-1 ring-[#CA8A04]/30",
  oportunidade: "bg-[#16A34A]/10 text-[#15803D] ring-1 ring-[#16A34A]/20",
  ativo: "bg-[#16A34A]/10 text-[#15803D] ring-1 ring-[#16A34A]/20",
  inativo: "bg-[#ED1C24]/10 text-[#B91C1C] ring-1 ring-[#ED1C24]/20",
  potencial: "bg-[#FFF200]/30 text-[#854D0E] ring-1 ring-[#CA8A04]/30",
  alto: "bg-[#F97316]/10 text-[#C2410C] ring-1 ring-[#F97316]/20",
  medio: "bg-[#1061AF]/10 text-[#0F58A0] ring-1 ring-[#1061AF]/20",
};

const labels: Record<string, string> = {
  critica: "Prioridade crítica",
  alta: "Alta prioridade",
  media: "Média prioridade",
  atencao: "Atenção",
  oportunidade: "Oportunidade",
};

export function PriorityBadge({ level, className = "" }: Props) {
  const key = level.toLowerCase();
  const cls = styles[key] ?? "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls} ${className}`}>
      {labels[key] ?? level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "bg-slate-100 text-slate-700 ring-1 ring-slate-200";
  if (s.includes("ativo") && !s.includes("inativo")) cls = styles.ativo;
  else if (s.includes("inativo")) cls = styles.inativo;
  else if (s.includes("potencial")) cls = styles.potencial;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
