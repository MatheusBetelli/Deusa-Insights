import { apiRequest } from "./api";
import type { MapOpportunity } from "@/types/mapOpportunity";
import type { PotentialLevel } from "@/types/lead";

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
