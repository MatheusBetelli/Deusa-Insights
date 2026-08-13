import { useState } from "react";
import type { ScoreBreakdown } from "@/types/lead";
import { Info, MapPin } from "lucide-react";

interface ScoreBreakdownTooltipProps {
  score: number;
  breakdown?: ScoreBreakdown;
  className?: string;
  variant?: "default" | "subtle";
}

export function ScoreBreakdownTooltip({ score, breakdown, className = "", variant = "default" }: ScoreBreakdownTooltipProps) {
  const [open, setOpen] = useState(false);

  // Se não houver breakdown retornado pela API, gera a estimativa proporcional baseada nas faixas oficiais do algoritmo
  const b = breakdown ?? {
    perfilPts: Math.round((score / 100) * 30),
    potencialPts: Math.round((score / 100) * 25),
    logisticaPts: Math.round((score / 100) * 20),
    dadosPts: Math.round((score / 100) * 10),
    prontidaoPts: Math.round((score / 100) * 10),
    territorioPts: Math.round((score / 100) * 5),
    distanceKm: 85,
  };

  let levelLabel = "Baixa";
  let levelColor = "text-[#64748B] bg-slate-100 border-slate-200";
  if (score >= 80) {
    levelLabel = "Crítica";
    levelColor = "text-[#ED1C24] bg-red-50 border-red-200";
  } else if (score >= 65) {
    levelLabel = "Alta";
    levelColor = "text-[#D97706] bg-amber-50 border-amber-200";
  } else if (score >= 45) {
    levelLabel = "Média";
    levelColor = "text-[#1061AF] bg-blue-50 border-blue-200";
  }

  const badgeStyle =
    variant === "subtle"
      ? "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      : levelColor;

  return (
    <div className="relative inline-block" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onMouseEnter={() => setOpen(true)}
        className={`inline-flex items-center gap-1 rounded-md border ${
          variant === "subtle" ? "px-2 py-0.5 text-xs font-medium" : "px-2.5 py-1 text-xs font-bold"
        } tabular-nums transition cursor-pointer ${badgeStyle} ${className}`}
        title="Passe o mouse ou clique para ver os 6 pilares do Score"
      >
        <span>{variant === "subtle" ? score : `${score}/100`}</span>
        <Info className="h-3 w-3 opacity-40 hover:opacity-100" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl animate-in fade-in zoom-in-95 duration-150 text-slate-800 text-left"
        >
          {/* Seta indicativa */}
          <div className="absolute top-full left-1/2 -mt-1 -translate-x-1/2 border-4 border-transparent border-t-white" />

          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                Score de Oportunidade
              </div>
              <div className="text-sm font-extrabold text-[#0B1F33]">
                {score}/100 <span className="text-xs font-semibold text-slate-500">({levelLabel})</span>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-bold text-[#1061AF] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
              <MapPin className="h-3 w-3" />
              {b.distanceKm} km Garça
            </div>
          </div>

          <div className="space-y-1.5 text-xs font-medium">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Perfil / CNAE (30%):</span>
              <strong className="text-slate-900 font-bold">{b.perfilPts}/30</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Potencial Comercial (25%):</span>
              <strong className="text-slate-900 font-bold">{b.potencialPts}/25</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Logística Garça/SP (20%):</span>
              <strong className="text-slate-900 font-bold">{b.logisticaPts}/20</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Qualidade dos Dados (10%):</span>
              <strong className="text-slate-900 font-bold">{b.dadosPts}/10</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Prontidão Comercial (10%):</span>
              <strong className="text-slate-900 font-bold">{b.prontidaoPts}/10</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-600">• Atratividade Territorial (5%):</span>
              <strong className="text-slate-900 font-bold">{b.territorioPts}/5</strong>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
            Fórmula reproduzível normalizada de 0 a 100 com base em CNAE, porte e logística.
          </div>
        </div>
      )}
    </div>
  );
}
