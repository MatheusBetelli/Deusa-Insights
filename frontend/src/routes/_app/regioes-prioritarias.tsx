import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PriorityBadge } from "@/components/common/PriorityBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/InterfaceStates";
import { leadsService } from "@/services/leadsService";
import type { Lead } from "@/types/lead";
import { ArrowUpRight, Users, Sparkles, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/regioes-prioritarias")({
  component: Regs,
});

function accentColor(p: string) {
  if (p === "critica") return "#ED1C24";
  if (p === "alta") return "#F97316";
  return "#1061AF";
}

function reasonForRegion(region: { prioridade: string; score: number }) {
  if (region.prioridade === "critica") return "Alta oportunidade com cobertura abaixo do potencial comercial.";
  if (region.score < 75) return "Região com potencial moderado e necessidade de acompanhamento.";
  return "Região com potencial de expansão e necessidade de acompanhamento.";
}

function Regs() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      setLeads(await leadsService.getLeads());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar regiões prioritárias.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  const regions = useMemo(() => {
    const grouped = new Map<string, { cidade: string; uf: string; oportunidades: number; score: number; totalScore: number }>();
    leads.forEach((lead) => {
      const key = `${lead.company.cidade}-${lead.company.uf}`;
      const current = grouped.get(key) ?? { cidade: lead.company.cidade, uf: lead.company.uf, oportunidades: 0, score: 0, totalScore: 0 };
      current.oportunidades += 1;
      current.totalScore += lead.score;
      current.score = Math.round(current.totalScore / current.oportunidades);
      grouped.set(key, current);
    });
    return Array.from(grouped.values())
      .map((region) => ({
        ...region,
        prioridade: region.score >= 90 ? "critica" : region.score >= 75 ? "alta" : "media",
      }))
      .sort((a, b) => b.score - a.score);
  }, [leads]);

  return (
    <div>
      <PageHeader title="Regiões Prioritárias" subtitle="Ranking objetivo de onde a equipe comercial deve concentrar esforços." />

      {error && <div className="mb-4"><ErrorState description={error} action={<button onClick={loadLeads} className="h-9 rounded-lg bg-[#0B1F33] px-3 text-xs font-bold text-white">Tentar novamente</button>} /></div>}
      {loading ? (
        <LoadingState message="Carregando regiões prioritárias..." />
      ) : regions.length === 0 ? (
        <EmptyState title="Nenhuma região encontrada" description="Importe CNPJs ou crie leads para gerar o ranking regional." />
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {regions.map((r) => {
          const c = accentColor(r.prioridade);
          return (
            <div key={r.cidade} className="overflow-hidden rounded-xl border border-[#DDE5EF] bg-white shadow-sm transition hover:shadow-md">
              <div className="h-1.5 w-full" style={{ background: c }} />
              <div className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wide text-[#64748B] font-semibold">{r.uf} · Região monitorada</div>
                    <h3 className="text-xl font-bold text-[#0B1F33] mt-1">{r.cidade}</h3>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums" style={{ color: c }}>{r.score}</div>
                    <div className="text-[11px] text-[#64748B] -mt-1">Score</div>
                  </div>
                </div>

                <div className="mt-3"><PriorityBadge level={r.prioridade} /></div>

                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { i: Users, l: "Potenciais", v: r.oportunidades },
                    { i: Sparkles, l: "Score", v: r.score },
                    { i: Activity, l: "Cobertura", v: "API" },
                  ].map((m) => {
                    const Icon = m.i;
                    return (
                      <div key={m.l} className="rounded-lg bg-[#F8FAFC] p-3">
                        <Icon className="h-4 w-4 text-[#64748B]" />
                        <div className="text-lg font-bold text-[#0B1F33] mt-1 leading-none tabular-nums">{m.v}</div>
                        <div className="text-[11px] text-[#64748B] mt-0.5">{m.l}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-lg bg-[#F8FAFC] p-3">
                  <div className="text-[11px] uppercase font-bold text-[#64748B]">Motivo da prioridade</div>
                  <div className="mt-1 text-sm text-[#0B1F33] leading-relaxed">
                    {reasonForRegion(r)}
                  </div>
                </div>

                <button className="mt-5 w-full h-10 rounded-lg border border-[#DDE5EF] hover:border-[#1061AF] hover:bg-[#1061AF] hover:text-white text-[#0B1F33] text-sm font-semibold flex items-center justify-center gap-2 transition">
                  Abrir detalhe <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
