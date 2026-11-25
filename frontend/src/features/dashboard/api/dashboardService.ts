import { apiRequest } from "@/services/api";
import type { DashboardQuery, DashboardSummary } from "@/features/dashboard/types/dashboard";

export const dashboardService = {
  getSummary: (query?: DashboardQuery) =>
    apiRequest<DashboardSummary>("/dashboard/summary", {}, query),
};
