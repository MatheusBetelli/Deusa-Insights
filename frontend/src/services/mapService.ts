import { apiRequest } from "./api";
import type { MapOpportunity } from "@/types/mapOpportunity";

export const mapService = {
  getOpportunities: () => apiRequest<MapOpportunity[]>("/map/opportunities"),
  
  optimizeLocations: (params?: { limit?: number; city?: string; minScore?: number; dryRun?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit !== undefined) searchParams.append("limit", String(params.limit));
    if (params?.city) searchParams.append("city", params.city);
    if (params?.minScore !== undefined) searchParams.append("minScore", String(params.minScore));
    if (params?.dryRun !== undefined) searchParams.append("dryRun", String(params.dryRun));
    
    return apiRequest<any>(`/companies/verify-google-batch?${searchParams.toString()}`, {
      method: "POST",
    });
  },
};
