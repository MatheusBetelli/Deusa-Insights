import { apiRequest } from "./api";
import type { DashboardQuery, DashboardSummary } from "@/types/dashboard";

export const dashboardService = {
  getSummary: (query?: DashboardQuery) =>
    apiRequest<DashboardSummary>("/dashboard/summary", {}, query),
};
