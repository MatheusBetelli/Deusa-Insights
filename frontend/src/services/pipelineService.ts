import { apiRequest } from "./api";
import type { LeadStatus } from "@/types/lead";
import type { Pipeline, PipelineStage } from "@/types/pipeline";

export type PipelineQuery = {
  page?: number;
  pageSize?: number;
  columnPageSize?: number;
  search?: string;
  city?: string;
  cnae?: string;
};

export const pipelineService = {
  getPipeline: (query?: PipelineQuery) => apiRequest<Pipeline>("/pipeline", {}, query),
  getStage: (status: LeadStatus, query?: PipelineQuery) =>
    apiRequest<PipelineStage>(`/pipeline/stage/${status}`, {}, query),
};
