import type { DashboardSummary } from "./dashboard";

export type PipelineStatus = "NEW" | "CONVERTED";

type PipelineCard = {
  id: string;
  leadId: string | null;
  companyName: string;
  city: string | null;
  status: PipelineStatus;
  assignedTo: string | null;
};

export type PipelineStage = {
  status: PipelineStatus;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  conversionRate: number;
  items: PipelineCard[];
};

export type Pipeline = {
  total: number;
  stages: Record<PipelineStatus, PipelineStage>;
  period: DashboardSummary["period"];
};
