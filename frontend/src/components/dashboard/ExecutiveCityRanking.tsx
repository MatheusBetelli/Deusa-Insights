import { useMemo, useState } from "react";
import type { CityExpansion } from "@/types/dashboard";
import { Building2, BarChart2, Table as TableIcon, Filter, Target, ChevronRight, Check } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"table" | "chart">("table");

  // Ordenação analítica por Maior Espaço Comercial Real (Oportunidades pendentes decrescente)
  const sortedCities = useMemo(() => {
    return [...expansionByCity].sort(
      (a, b) => b.opportunities - a.opportunities || b.expansionPercentage - a.expansionPercentage,
    );
  }, [expansionByCity]);

  const maxOpportunities = useMemo(() => {
    return Math.max(...sortedCities.map((item) => item.opportunities), 1);
  }, [sortedCities]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Top Header com Seletor de Visão (Tabela vs Gráfico) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-emerald-600/10 p-1.5 text-emerald-600">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Potencial por Município</h3>
            <p className="text-xs text-slate-500">Análise comparativa do espaço de expansão territorial</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Seletor Tabela / Gráfico */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                viewMode === "table"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Tabela</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("chart")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-bold transition ${
                viewMode === "chart"
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <BarChart2 className="h-3.5 w-3.5" />
              <span>Gráfico</span>
            </button>
          </div>

          {selectedCity !== "Todas" && (
            <button
              type="button"
              onClick={() => onSelectCity("Todas")}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Filter className="h-3 w-3" />
              <span>Limpar cidade</span>
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo Principal (Tabela ou Gráfico) */}
      <div className="p-4">
        {sortedCities.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center text-slate-400">
            <Building2 className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs font-semibold">Nenhum município disponível para a amostra atual.</p>
          </div>
        ) : viewMode === "table" ? (
          /* MODO TABELA EXECUTIVA */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="pb-2.5 pl-2">#</th>
                  <th className="pb-2.5">Município</th>
                  <th className="pb-2.5">Oportunidades (Potencial)</th>
                  <th className="pb-2.5 text-center">Clientes Ativos</th>
                  <th className="pb-2.5 text-right">Cobertura</th>
                  <th className="pb-2.5 pr-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedCities.map((item, index) => {
                  const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();
                  const oppPercent = Math.min(100, Math.round((item.opportunities / maxOpportunities) * 100));

                  return (
                    <tr
                      key={item.city}
                      onClick={() => onSelectCity(isSelected ? "Todas" : item.city)}
                      className={`group cursor-pointer transition ${
                        isSelected
                          ? "bg-blue-50/60 font-semibold"
                          : "hover:bg-slate-50/80"
                      }`}
                    >
                      <td className="py-2.5 pl-2 font-extrabold text-slate-400">
                        #{index + 1}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{item.city}</span>
                          {isSelected && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                              <Check className="h-2.5 w-2.5" /> Filtrado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:w-44">
                            <div
                              className="h-full rounded-full bg-amber-500 transition-all duration-500"
                              style={{ width: `${oppPercent}%` }}
                            />
                          </div>
                          <span className="font-extrabold tabular-nums text-slate-800">
                            {formatNumber(item.opportunities)} opp
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            item.clients > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {formatNumber(item.clients)} {item.clients === 1 ? "cliente" : "clientes"}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-extrabold tabular-nums text-slate-700">
                        {formatPercent(item.coveragePercentage)}
                      </td>
                      <td className="py-2.5 pr-2 text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition">
                          Filtrar <ChevronRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* MODO GRÁFICO DE BARRAS ANALÍTICO */
          <div className="space-y-3 py-1">
            {sortedCities.map((item, index) => {
              const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();
              const oppPercent = Math.min(100, Math.round((item.opportunities / maxOpportunities) * 100));

              return (
                <div
                  key={item.city}
                  onClick={() => onSelectCity(isSelected ? "Todas" : item.city)}
                  className={`group cursor-pointer rounded-lg border p-3 transition ${
                    isSelected
                      ? "border-blue-600 bg-blue-50/50 shadow-2xs"
                      : "border-slate-100 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-400">#{index + 1}</span>
                      <span className="font-bold text-slate-900">{item.city}</span>
                      {isSelected && (
                        <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          Filtrado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-slate-500 font-semibold">
                      <span>
                        <strong>{formatNumber(item.opportunities)}</strong> oportunidades
                      </span>
                      <span>•</span>
                      <span>
                        <strong>{formatNumber(item.clients)}</strong> clientes
                      </span>
                      <span>•</span>
                      <span className="text-emerald-600">
                        {formatPercent(item.coveragePercentage)} cobertura
                      </span>
                    </div>
                  </div>

                  {/* Barra Dupla Proporcional */}
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500"
                      style={{ width: `${oppPercent}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Informativo */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2 text-xs text-slate-500 flex items-center justify-between">
        <span>Clique na linha ou barra do município para filtrar todo o Dashboard</span>
        <span className="text-[11px] text-slate-400">Ordenado por espaço comercial disponível</span>
      </div>
    </div>
  );
}
