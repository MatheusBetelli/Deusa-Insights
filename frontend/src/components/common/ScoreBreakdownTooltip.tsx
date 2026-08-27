import type { PotentialLevel, ScoreBreakdown } from "@/types/lead";
import { Info, MapPin } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { potentialLabels } from "@/lib/commercial-formatters";

interface ScoreBreakdownTooltipProps {
  score: number;
  potentialLevel?: PotentialLevel;
  breakdown?: ScoreBreakdown;
  className?: string;
  variant?: "default" | "subtle";
}

function getLevelColor(level?: PotentialLevel): string {
  if (level === "CRITICAL") return "text-[#ED1C24] bg-red-50 border-red-200";
  if (level === "HIGH") return "text-[#D97706] bg-amber-50 border-amber-200";
  if (level === "MEDIUM") return "text-[#1061AF] bg-blue-50 border-blue-200";
  return "text-[#64748B] bg-slate-100 border-slate-200";
}

export function ScoreBreakdownTooltip({
  score,
  potentialLevel,
  breakdown,
  className = "",
  variant = "default",
}: ScoreBreakdownTooltipProps) {
  // Se não houver breakdown retornado pela API, exibe apenas a distribuição proporcional do score recebido.
  const b = breakdown ?? {
    perfilPts: Math.round((score / 100) * 30),
    potencialPts: Math.round((score / 100) * 25),
    logisticaPts: Math.round((score / 100) * 20),
    dadosPts: Math.round((score / 100) * 10),
    prontidaoPts: Math.round((score / 100) * 10),
    territorioPts: Math.round((score / 100) * 5),
    distanceKm: 85,
  };

  const levelLabel = potentialLevel ? potentialLabels[potentialLevel] : "Classificado";
  const levelColor = getLevelColor(potentialLevel);

  const badgeStyle =
    variant === "subtle"
      ? "bg-slate-50 border-slate-200/80 text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      : levelColor;

  const pillars = [
    { label: "Perfil CNAE Alvo", score: b.perfilPts, max: 30 },
    { label: "Cluster Logístico", score: b.potencialPts, max: 25 },
    { label: "Proximidade Garça/SP", score: b.logisticaPts, max: 20 },
    { label: "Porte / Giro Estimado", score: b.prontidaoPts, max: 10 },
    { label: "Qualidade Cadastral & GPS", score: b.dadosPts, max: 10 },
    { label: "Atratividade Territorial", score: b.territorioPts, max: 5 },
  ];

  return (
    <HoverCard openDelay={100} closeDelay={150}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={`inline-flex items-center gap-1 rounded-md border ${
            variant === "subtle"
              ? "px-2 py-0.5 text-xs font-medium"
              : "px-2.5 py-1 text-xs font-bold"
          } tabular-nums transition cursor-pointer ${badgeStyle} ${className}`}
        >
          <span>{variant === "subtle" ? score : `${score}/100`}</span>
          <Info className="h-3 w-3 opacity-40 hover:opacity-100" />
        </button>
      </HoverCardTrigger>

      <HoverCardContent
        align="center"
        side="bottom"
        sideOffset={6}
        onClick={(e) => e.stopPropagation()}
        className="w-64 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xl text-slate-800 text-left z-50"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2.5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Score de Oportunidade
            </div>
            <div className="text-sm font-extrabold text-[#0B1F33]">
              {score}/100{" "}
              <span className="text-xs font-semibold text-slate-500">({levelLabel})</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-bold text-[#1061AF] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
            <MapPin className="h-3 w-3" />
            {b.distanceKm} km Garça
          </div>
        </div>

        <div className="space-y-2">
          {pillars.map((p) => {
            const pct = Math.min(100, Math.max(0, Math.round((p.score / p.max) * 100)));
            return (
              <div key={p.label} className="space-y-0.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{p.label}</span>
                  <span className="font-bold text-slate-900 tabular-nums">
                    +{p.score} <span className="text-[10px] font-normal text-slate-400">pts</span>
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1061AF] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 leading-tight">
          Pontuação focada em Minimercados, Supermercados e Açougues próximos.
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
