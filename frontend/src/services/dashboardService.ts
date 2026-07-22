import { apiRequest } from "./api";
import type { DashboardSummary } from "@/types/dashboard";

export const dashboardService = {
  getSummary: (uf?: string) => apiRequest<DashboardSummary>("/dashboard/summary", {}, uf && uf !== "Todos" ? { uf } : undefined),
};
