import { useMemo } from "react";
import type { CityExpansion } from "@/types/dashboard";
import { Building2, Filter, Check } from "lucide-react";
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

  const maxOpportunities = useMemo(() => {
    return Math.max(...sortedCities.map((item) => item.opportunities), 1);
  }, [sortedCities]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Top Header Limpo e Profissional */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-white px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-bold text-slate-900">Potencial por Município</h3>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 border border-slate-200">
              {sortedCities.length} municípios
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Análise comparativa do espaço de expansão territorial
          </p>
        </div>

        {selectedCity !== "Todas" && (
          <button
            type="button"
            onClick={() => onSelectCity("Todas")}
            className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-200 transition"
          >
            <Filter className="h-3 w-3 text-slate-500" />
            <span>Limpar ({selectedCity})</span>
          </button>
        )}
      </div>

      {/* Conteúdo Principal - Tabela Executiva Clean */}
      <div className="p-4 sm:p-5 bg-white">
        {sortedCities.length === 0 ? (
          <div className="flex h-44 flex-col items-center justify-center text-center text-slate-400">
            <Building2 className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-xs font-semibold">
              Nenhum município disponível para a amostra atual.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pl-2 w-12 text-center">#</th>
                  <th className="pb-3 pl-2">Município</th>
                  <th className="pb-3 pl-4">Oportunidades (Potencial)</th>
                  <th className="pb-3 text-center">Clientes Ativos</th>
                  <th className="pb-3 pr-2 text-right">Cobertura</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {sortedCities.map((item, index) => {
                  const isSelected = selectedCity.toLowerCase() === item.city.toLowerCase();
                  const oppPercent = Math.min(
                    100,
                    Math.round((item.opportunities / maxOpportunities) * 100),
                  );
                  const rank = index + 1;

                  return (
                    <tr
                      key={item.city}
                      onClick={() => onSelectCity(isSelected ? "Todas" : item.city)}
                      className={`group cursor-pointer transition-all ${
                        isSelected ? "bg-blue-50/60 font-semibold" : "hover:bg-slate-50/80"
                      }`}
                    >
                      {/* Ranking # */}
                      <td className="py-3 pl-2 text-center">
                        <span
                          className={`text-[11px] font-bold ${rank <= 3 ? "text-slate-900" : "text-slate-400"}`}
                        >
                          #{rank}
                        </span>
                      </td>

                      <td className="py-3 pl-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-xs">{item.city}</span>
                          {rank === 1 && (
                            <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-[#1061AF] border border-blue-200/60 tracking-wider uppercase">
                              Maior Oportunidade
                            </span>
                          )}
                          {isSelected && (
                            <span className="inline-flex items-center gap-0.5 rounded bg-[#1061AF] px-1.5 py-0.5 text-[10px] font-bold text-white shadow-2xs">
                              <Check className="h-2.5 w-2.5" /> Filtrado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Barra Corporativa Azul Deusa */}
                      <td className="py-3 pl-4">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-32 overflow-hidden rounded-full bg-slate-100 sm:w-48">
                            <div
                              className="h-full rounded-full bg-[#1061AF] transition-all duration-300"
                              style={{ width: `${oppPercent}%` }}
                            />
                          </div>
                          <span className="font-bold tabular-nums text-slate-800 text-xs">
                            {formatNumber(item.opportunities)}{" "}
                            <span className="font-normal text-slate-400 text-[10px]">opp</span>
                          </span>
                        </div>
                      </td>

                      <td className="py-3 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            item.clients > 0
                              ? "bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200/50"
                              : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {formatNumber(item.clients)} {item.clients === 1 ? "cliente" : "clientes"}
                        </span>
                      </td>

                      <td className="py-3 pr-2 text-right font-bold tabular-nums text-slate-700">
                        {formatPercent(item.coveragePercentage)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Informativo Limpo */}
      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span className="text-slate-500 font-medium">
          Clique na linha do município para filtrar todo o Dashboard em tempo real
        </span>
        <span className="text-[11px] text-slate-400 font-normal">
          Ordenado por espaço comercial disponível
        </span>
      </div>
    </div>
  );
}
