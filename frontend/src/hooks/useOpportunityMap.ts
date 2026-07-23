import { useEffect, useState } from "react";
import { mapService } from "@/services/mapService";
import type {
  HeatmapData,
  MapOpportunity,
  PendingLocation,
  ValidateLocationPayload,
} from "@/types/mapOpportunity";

export type UseOpportunityMapOptions = {
  initialUf?: string;
  initialCity?: string;
  initialTab?: "mapa" | "pendencias";
};

export function useOpportunityMap(options: UseOpportunityMapOptions = {}) {
  const [activeTab, setActiveTab] = useState<"mapa" | "pendencias">(
    options.initialTab === "pendencias" ? "pendencias" : "mapa",
  );
  const [viewMode, setViewMode] = useState<"markers" | "heatmap">("markers");

  // ── Estados de dados ──────────────────────────────────────────────────────
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Marcadores: somente empresas ATIVAS com validação CONFIRMADA e coordenada manual comprovada
  const [opportunities, setOpportunities] = useState<MapOpportunity[]>([]);

  // Mapa de Calor: empresas ATIVAS agrupadas por município (independente de validação)
  const [heatmapData, setHeatmapData] = useState<HeatmapData>({
    points: [],
    totalEmpresas: 0,
    totalMunicipios: 0,
  });

  // Pendências: empresas ATIVAS aguardando validação manual
  const [pendingLocations, setPendingLocations] = useState<PendingLocation[]>([]);

  // ── Filtros ───────────────────────────────────────────────────────────────
  const [selectedUf, setSelectedUf] = useState(options.initialUf || "Todos");
  const [selectedCity, setSelectedCity] = useState(options.initialCity || "Todas");
  const [selectedCnae, setSelectedCnae] = useState("Todos");
  const [selectedNivel, setSelectedNivel] = useState("Todos");
  const [selectedStatusValidacao, setSelectedStatusValidacao] = useState("confirmado");
  const [searchQuery, setSearchQuery] = useState("");
  const [clustersOn, setClustersOn] = useState(true);

  // Item em Validação
  const [validatingItem, setValidatingItem] = useState<PendingLocation | MapOpportunity | null>(
    null,
  );

  async function loadMapData() {
    setDataLoading(true);
    setDataError(null);
    try {
      const [opps, pends, heat] = await Promise.all([
        // Marcadores: validação comercial confirmada
        mapService.getOpportunities({
          estado: selectedUf,
          municipio: selectedCity,
          cnae: selectedCnae,
          nivelOportunidade: selectedNivel,
          statusValidacao: selectedStatusValidacao,
          search: searchQuery,
        }),
        // Pendências: aguardando validação manual
        mapService.getPending({
          estado: selectedUf,
          municipio: selectedCity,
          cnae: selectedCnae,
          search: searchQuery,
        }),
        // Mapa de Calor Regional: empresas ATIVAS por município (sem validação)
        mapService.getHeatmap({
          estado: selectedUf,
          cnae: selectedCnae,
        }),
      ]);

      setOpportunities(opps);
      setPendingLocations(pends);
      setHeatmapData(heat);
    } catch (err) {
      setDataError(err instanceof Error ? err.message : "Erro ao carregar dados do mapa.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    loadMapData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUf, selectedCity, selectedCnae, selectedNivel, selectedStatusValidacao, searchQuery]);

  function handleResetFilters() {
    setSelectedUf("Todos");
    setSelectedCity("Todas");
    setSelectedCnae("Todos");
    setSelectedNivel("Todos");
    setSelectedStatusValidacao("confirmado");
    setSearchQuery("");
  }

  async function saveValidation(id: string, payload: ValidateLocationPayload) {
    await mapService.validateLocation(id, payload);
    setValidatingItem(null);
    await loadMapData();
  }

  return {
    activeTab,
    setActiveTab,
    viewMode,
    setViewMode,
    dataLoading,
    dataError,
    opportunities,
    heatmapData,
    pendingLocations,
    selectedUf,
    setSelectedUf,
    selectedCity,
    setSelectedCity,
    selectedCnae,
    setSelectedCnae,
    selectedNivel,
    setSelectedNivel,
    selectedStatusValidacao,
    setSelectedStatusValidacao,
    searchQuery,
    setSearchQuery,
    clustersOn,
    setClustersOn,
    validatingItem,
    setValidatingItem,
    loadMapData,
    handleResetFilters,
    saveValidation,
  };
}
