import { ESTADOS_UF } from "@/lib/constants";
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Search } from "lucide-react";

export type MapFiltersBarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedUf: string;
  onUfChange: (uf: string) => void;
  selectedCity: string;
  onCityChange: (city: string) => void;
  selectedCnae: string;
  onCnaeChange: (cnae: string) => void;
  selectedNivel: string;
  onNivelChange: (nivel: string) => void;
  selectedStatusValidacao: string;
  onStatusValidacaoChange: (status: string) => void;
  onResetFilters: () => void;
  activeTab: "mapa" | "pendencias";
  countConfirmados: number;
  countProvaveis: number;
  countPendentes: number;
};

export function MapFiltersBar({
  searchQuery,
  onSearchChange,
  selectedUf,
  onUfChange,
  selectedCity,
  onCityChange,
  selectedCnae,
  onCnaeChange,
  selectedNivel,
  onNivelChange,
  selectedStatusValidacao,
  onStatusValidacaoChange,
  onResetFilters,
  activeTab,
  countConfirmados,
  countProvaveis,
  countPendentes,
}: MapFiltersBarProps) {
  return (
    <section className="rounded-xl border border-[#DDE5EF] bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Buscar por CNPJ ou nome..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] pl-9 pr-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
          />
        </div>

        <select
          value={selectedUf}
          onChange={(e) => onUfChange(e.target.value)}
          className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        >
          <option value="Todos">UF: Todos</option>
          {ESTADOS_UF.map((uf) => (
            <option key={uf} value={uf}>
              {uf}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Cidade..."
          value={selectedCity === "Todas" ? "" : selectedCity}
          onChange={(e) => onCityChange(e.target.value || "Todas")}
          className="h-10 w-36 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        />

        <select
          value={selectedCnae}
          onChange={(e) => onCnaeChange(e.target.value)}
          className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
        >
          <option value="Todos">CNAE: Todos</option>
          <option value="4712100">4712100 - Minimercados e Mercearias</option>
          <option value="4711302">4711302 - Supermercados</option>
          <option value="4721102">4721102 - Padarias</option>
        </select>

        {activeTab === "mapa" && (
          <select
            value={selectedNivel}
            onChange={(e) => onNivelChange(e.target.value)}
            className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
          >
            <option value="Todos">Oportunidade: Todas</option>
            <option value="alta">Alta</option>
            <option value="media">Média</option>
            <option value="baixa">Baixa</option>
          </select>
        )}

        {activeTab === "mapa" && (
          <select
            value={selectedStatusValidacao}
            onChange={(e) => onStatusValidacaoChange(e.target.value)}
            className="h-10 rounded-lg border border-[#DDE5EF] bg-[#F8FAFC] px-3 text-sm text-[#0B1F33] outline-none focus:border-[#1061AF]"
          >
            <option value="confirmado">Status: Somente Confirmados (Regra Estrita)</option>
            <option value="provavel">Status: Incluir Prováveis</option>
            <option value="Todos">Status: Todos</option>
          </select>
        )}

        <button
          onClick={onResetFilters}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#DDE5EF] bg-white text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0B1F33]"
          title="Limpar Filtros"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-[#EEF2F7] pt-3 text-xs font-semibold text-[#64748B]">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Confirmados:</span>
          <strong className="text-emerald-700">{countConfirmados}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          <span>Prováveis:</span>
          <strong className="text-amber-600">{countProvaveis}</strong>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-sky-600" />
          <span>Pendentes:</span>
          <strong className="text-sky-700">{countPendentes}</strong>
        </div>
      </div>
    </section>
  );
}
