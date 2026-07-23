import { useCallback, useEffect, useState } from "react";
import { mapService } from "@/services/mapService";
import type { HeatmapPoint } from "@/types/mapOpportunity";

export type HeatmapFilters = {
  estado: string;
  municipio: string;
  cnae: string;
};

export type UseHeatmapMapResult = {
  points: HeatmapPoint[];
  totalEmpresas: number;
  totalMunicipios: number;
  loading: boolean;
  error: string | null;
  filters: HeatmapFilters;
  setEstado: (v: string) => void;
  setMunicipio: (v: string) => void;
  setCnae: (v: string) => void;
  resetFilters: () => void;
  reload: () => void;
};

const INITIAL_FILTERS: HeatmapFilters = {
  estado: "Todos",
  municipio: "Todas",
  cnae: "Todos",
};

export function useHeatmapMap(): UseHeatmapMapResult {
  const [filters, setFilters] = useState<HeatmapFilters>(INITIAL_FILTERS);
  const [points, setPoints] = useState<HeatmapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await mapService.getHeatmap({
        estado: filters.estado,
        municipio: filters.municipio,
        cnae: filters.cnae,
      });
      // A API agora retorna HeatmapPoint[] diretamente
      setPoints(Array.isArray(data) ? data : (data as { points?: HeatmapPoint[] }).points ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados do mapa de calor.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    load();
  }, [load]);

  const totalEmpresas = points.reduce((sum, p) => sum + p.quantidadeEmpresas, 0);
  const totalMunicipios = points.length;

  return {
    points,
    totalEmpresas,
    totalMunicipios,
    loading,
    error,
    filters,
    setEstado: (v) => setFilters((f) => ({ ...f, estado: v, municipio: "Todas" })),
    setMunicipio: (v) => setFilters((f) => ({ ...f, municipio: v })),
    setCnae: (v) => setFilters((f) => ({ ...f, cnae: v })),
    resetFilters: () => setFilters(INITIAL_FILTERS),
    reload: load,
  };
}
