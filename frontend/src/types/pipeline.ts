import type { LeadStatus, PotentialLevel } from "./lead";

export type PipelineCard = {
  id: string;
  companyName: string;
  city: string;
  status: LeadStatus;
  score: number;
  potentialLevel: PotentialLevel;
  scoreReasons?: string[];
  assignedTo: string | null;
};

export type PipelineStage = {
  status: LeadStatus;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  conversionRate: number;
  items: PipelineCard[];
};

export type Pipeline = {
  total: number;
  stages: Partial<Record<LeadStatus, PipelineStage>>;
};
