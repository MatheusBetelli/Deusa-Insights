import { apiRequest } from "@/services/api";
import type { MapOpportunity } from "@/features/map/types/mapOpportunity";
import type { PotentialLevel } from "@/features/leads/types/lead";

export type MapOpportunityQuery = {
  uf?: string;
  city?: string;
  search?: string;
  companyId?: string;
  cnae?: string;
  potentialLevel?: PotentialLevel;
  client?: "true" | "false";
};

export const mapService = {
  getOpportunities: (query?: MapOpportunityQuery) =>
    apiRequest<MapOpportunity[]>("/map/opportunities", {}, query),
};
