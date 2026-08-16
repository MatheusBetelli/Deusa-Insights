import { useMemo } from "react";
import type { CityExpansion } from "@/types/dashboard";
import { Building2, CheckCircle2, ChevronRight, Filter, Target, TrendingUp } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/commercial-formatters";

interface ExecutiveCityRankingProps {
  expansionByCity: CityExpansion[];
  selectedCity?: string;
  onSelectCity: (city: string) => void;
}

export function ExecutiveCityRanking({
  expansionByCity,
  selectedCity = "Todas",
  onSelectCity,
}: ExecutiveCityRankingProps) {
  // Ordenação analítica por Maior Espaço Comercial Real (Oportunidades pendentes decrescente)
  const sortedCities = useMemo(() => {
    return [...expansionByCity].sort(
      (a, b) => b.opportunities - a.opportunities || b.expansionPercentage - a.expansionPercentage,
    );
  }, [expansionByCity]);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-emerald-600/10 p-1.5 text-emerald-600">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Potencial por Município</h3>
            <p className="text-xs text-slate-500">Ranking por maior espaço de expansão comercial real</p>
          </div>
        </div>

        {selectedCity !== "Todas" && (
          <button
            onClick={() => onSelectCity("Todas")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
          >
            <span>Ver todas</span>
          </button>
        )}
      </div>

      {/* Tabela de Ranking Executivo */}
      <div className="flex-1 overflow-y-auto p-4">
        {sortedCities.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center text-center text-slate-400">
            <Building2 className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs">Nenhum município cadastrado na amostra atual.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {sortedCities.map((item, index) => {
              const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();

              return (
                <div
                  key={item.city}
                  onClick={() => onSelectCity(isSelected ? "Todas" : item.city)}
                  className={`group relative flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 transition cursor-pointer ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/50 shadow-xs"
                      : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        index === 0
                          ? "bg-amber-100 text-amber-800"
                          : index === 1
                            ? "bg-slate-200 text-slate-700"
                            : index === 2
                              ? "bg-amber-800/10 text-amber-900"
                              : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      #{index + 1}
                    </span>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{item.city}</span>
                        {isSelected && (
                          <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            Filtrado
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-xs text-slate-500">
                        <span>
                          <strong>{formatNumber(item.opportunities)}</strong> oportunidades
                        </span>
                        <span>•</span>
                        <span>
                          <strong>{formatNumber(item.clients)}</strong> clientes
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress Bar de Cobertura */}
                    <div className="w-28 text-right sm:w-36">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                        <span>Cobertura</span>
                        <span className="text-emerald-600">{formatPercent(item.coveragePercentage)}</span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${Math.min(100, Math.max(0, item.coveragePercentage))}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-slate-400 group-hover:text-blue-600">
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500">
        <span>Clique no município para filtrar a análise visual do Dashboard</span>
      </div>
    </div>
  );
}
