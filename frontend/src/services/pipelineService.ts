import { apiRequest } from "./api";
import type { DashboardQuery } from "@/types/dashboard";
import type { Pipeline, PipelineStage, PipelineStatus } from "@/types/pipeline";

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
