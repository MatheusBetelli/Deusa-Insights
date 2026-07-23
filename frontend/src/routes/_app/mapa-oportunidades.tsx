import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState } from "@/components/app/InterfaceStates";
import { HeatmapFiltersBar } from "@/components/map/HeatmapFiltersBar";
import { RegionalHeatmap } from "@/components/map/RegionalHeatmap";
import { useHeatmapMap } from "@/hooks/useHeatmapMap";

export const Route = createFileRoute("/_app/mapa-oportunidades")({
  validateSearch: (search) => ({
    uf: typeof search.uf === "string" ? search.uf : "Todos",
    city: typeof search.city === "string" ? search.city : "Todas",
  }),
  component: OpportunityMapPage,
});

function OpportunityMapPage() {
  const {
    points,
    totalEmpresas,
    totalMunicipios,
    loading,
    error,
    filters,
    setEstado,
    setMunicipio,
    setCnae,
    resetFilters,
    reload,
  } = useHeatmapMap();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mapa de Oportunidades"
        subtitle="Análise regional de concentração de empresas ativas por município."
      />

      {/* Filtros regionais */}
      <HeatmapFiltersBar
        selectedUf={filters.estado}
        onUfChange={setEstado}
        selectedCity={filters.municipio}
        onCityChange={setMunicipio}
        selectedCnae={filters.cnae}
        onCnaeChange={setCnae}
        onResetFilters={resetFilters}
        totalEmpresas={totalEmpresas}
        totalMunicipios={totalMunicipios}
      />

      {/* Erro global */}
      {error && !loading && (
        <ErrorState
          description={error}
          action={
            <button
              onClick={reload}
              className="rounded-lg bg-[#0B1F33] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#1061AF]"
            >
              Tentar novamente
            </button>
          }
        />
      )}

      {/* Mapa de Calor Regional */}
      <RegionalHeatmap points={points} loading={loading} error={error} />
    </div>
  );
}
