import { apiRequest } from "@/services/api";
import type { DashboardQuery } from "@/features/dashboard/types/dashboard";
import type { Pipeline, PipelineStage, PipelineStatus } from "@/features/pipeline/types/pipeline";

export type PipelineQuery = DashboardQuery & {
  page?: number;
  pageSize?: number;
  columnPageSize?: number;
  search?: string;
};

export const pipelineService = {
  getPipeline: (query?: PipelineQuery) => apiRequest<Pipeline>("/pipeline", {}, query),
  getStage: (status: PipelineStatus, query?: PipelineQuery) =>
    apiRequest<PipelineStage>(`/pipeline/stage/${status}`, {}, query),
};
