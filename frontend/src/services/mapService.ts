import { apiRequest } from "./api";
import type { MapOpportunity } from "@/types/mapOpportunity";

export const mapService = {
  getOpportunities: () => apiRequest<MapOpportunity[]>("/map/opportunities"),
};
