import { apiRequest } from "./api";
import type {
  HeatmapPoint,
  MapFiltersParams,
  MapOpportunity,
  PendingLocation,
  ValidateLocationPayload,
} from "@/types/mapOpportunity";

export const mapService = {
  // ── Mapa de Calor Regional ─────────────────────────────────────────────────
  // Retorna empresas ATIVAS agrupadas por município — sem validação individual
  // Endpoint: GET /map/heatmap
  getHeatmap: (params?: { estado?: string; municipio?: string; cnae?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.estado && params.estado !== "Todos") searchParams.append("estado", params.estado);
    if (params?.municipio && params.municipio !== "Todas") searchParams.append("municipio", params.municipio);
    if (params?.cnae && params.cnae !== "Todos") searchParams.append("cnae", params.cnae);

    const queryStr = searchParams.toString();
    return apiRequest<HeatmapPoint[]>(`/map/heatmap${queryStr ? `?${queryStr}` : ""}`);
  },

  // ── Endpoints internos (não usados no MVP do mapa) ─────────────────────────
  getOpportunities: (params?: MapFiltersParams) => {
    const searchParams = new URLSearchParams();
    if (params?.cnae && params.cnae !== "Todos") searchParams.append("cnae", params.cnae);
    if (params?.municipio && params.municipio !== "Todas") searchParams.append("municipio", params.municipio);
    if (params?.estado && params.estado !== "Todos") searchParams.append("estado", params.estado);
    if (params?.statusValidacao && params.statusValidacao !== "Todos") searchParams.append("statusValidacao", params.statusValidacao);
    if (params?.nivelOportunidade && params.nivelOportunidade !== "Todos") searchParams.append("nivelOportunidade", params.nivelOportunidade);
    if (params?.confiancaMinima !== undefined) searchParams.append("confiancaMinima", String(params.confiancaMinima));
    if (params?.possuiCoordenada !== undefined) searchParams.append("possuiCoordenada", String(params.possuiCoordenada));
    if (params?.cnpj) searchParams.append("cnpj", params.cnpj);
    if (params?.search) searchParams.append("search", params.search);

    const queryStr = searchParams.toString();
    return apiRequest<MapOpportunity[]>(`/map/opportunities${queryStr ? `?${queryStr}` : ""}`);
  },

  getPending: (params?: MapFiltersParams) => {
    const searchParams = new URLSearchParams();
    if (params?.cnae && params.cnae !== "Todos") searchParams.append("cnae", params.cnae);
    if (params?.municipio && params.municipio !== "Todas") searchParams.append("municipio", params.municipio);
    if (params?.estado && params.estado !== "Todos") searchParams.append("estado", params.estado);
    if (params?.statusValidacao && params.statusValidacao !== "Todos") searchParams.append("statusValidacao", params.statusValidacao);
    if (params?.search) searchParams.append("search", params.search);

    const queryStr = searchParams.toString();
    return apiRequest<PendingLocation[]>(`/map/pending${queryStr ? `?${queryStr}` : ""}`);
  },

  validateLocation: (companyId: string, payload: ValidateLocationPayload) => {
    return apiRequest<unknown>(`/companies/${companyId}/validate-location`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  optimizeLocations: (params?: { limit?: number; city?: string; minScore?: number; dryRun?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) searchParams.append("limit", String(params.limit));
    if (params?.city) searchParams.append("city", params.city);
    if (params?.minScore !== undefined) searchParams.append("minScore", String(params.minScore));
    if (params?.dryRun !== undefined) searchParams.append("dryRun", String(params.dryRun));

    return apiRequest<unknown>(`/companies/verify-google-batch?${searchParams.toString()}`, {
      method: "POST",
    });
  },

  getLocationCandidates: (companyId: string) => {
    return apiRequest<unknown>(`/companies/${companyId}/location-candidates`, {
      method: "POST",
    });
  },
};
