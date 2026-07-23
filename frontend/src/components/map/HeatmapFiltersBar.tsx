import { RotateCcw } from "lucide-react";
import { ESTADOS_UF } from "@/lib/constants";

// Filtros disponíveis no Mapa de Calor Regional
// Somente UF, município e CNAE — sem status de validação ou nível de oportunidade
export type HeatmapFiltersBarProps = {
  selectedUf: string;
  onUfChange: (uf: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedCnae: string;
  onCnaeChange: (cnae: string) => void;
  onResetFilters: () => void;
  totalEmpresas: number;
  totalMunicipios: number;
};

export function HeatmapFiltersBar({
  selectedUf,
  onUfChange,
  selectedCity,
  onCityChange,
  selectedCnae,
  onCnaeChange,
  onResetFilters,
  totalEmpresas,
  totalMunicipios,
}: HeatmapFiltersBarProps) {
  return (
    <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm space-y-3">
      {/* Linha de filtros */}
      <div className="flex flex-wrap items-center gap-3">
        {/* UF */}
        <select
          value={selectedUf}
          onChange={(e) => onUfChange(e.target.value)}
          className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        >
          <option value="Todos">Estado: Todos</option>
          {ESTADOS_UF.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>

        {/* Município */}
        <input
          type="text"
          placeholder="Filtrar por município..."
          value={selectedCity === "Todas" ? "" : selectedCity}
          onChange={(e) => onCityChange(e.target.value || "Todas")}
          className="h-10 w-52 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        />

        {/* CNAE */}
        <select
          value={selectedCnae}
          onChange={(e) => onCnaeChange(e.target.value)}
          className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        >
          <option value="Todos">CNAE: Todos</option>
          <option value="4712100">4712-1/00 — Minimercados e Mercearias</option>
          <option value="4711302">4711-3/02 — Supermercados</option>
          <option value="4721102">4721-1/02 — Padarias</option>
          <option value="4729699">4729-6/99 — Outros alimentícios</option>
        </select>

        {/* Limpar filtros */}
        <button
          onClick={onResetFilters}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDE5EF] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0B1F33] transition"
          title="Limpar Filtros"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      {/* Totalizadores regionais */}
      <div className="flex flex-wrap items-center gap-6 border-t border-[#EEF2F7] pt-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#1061AF]" />
          <span className="text-xs text-[#64748B]">
            Empresas analisadas:{" "}
            <strong className="text-[#0B1F33]">{totalEmpresas.toLocaleString("pt-BR")}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full bg-[#0B1F33]" />
          <span className="text-xs text-[#64748B]">
            Municípios:{" "}
            <strong className="text-[#0B1F33]">{totalMunicipios}</strong>
          </span>
        </div>
        <div className="ml-auto flex items-center gap-1.5 rounded-md bg-[#F0F4FF] px-3 py-1.5 text-xs font-semibold text-[#1061AF]">
          <span>Situação Cadastral:</span>
          <span className="font-bold text-emerald-600">ATIVA</span>
        </div>
      </div>
    </section>
  );
}
