import { Company } from "./company.model";
import { User } from "./user.model";

export type LeadStatus =
  | "NEW"
  | "NO_CONTACT"
  | "CONTACTED"
  | "INTERESTED"
  | "NEGOTIATION"
  | "CONVERTED"
  | "NOT_INTERESTED"
  | "INACTIVE";

export type PotentialLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface LeadInteraction {
  id: string;
  leadId: string;
  userId: string;
  type: string;
  description: string;
  createdAt: string;
  user?: User;
}

export interface Lead {
  id: string;
  companyId: string;
  status: LeadStatus;
  score: number;
  potentialLevel: PotentialLevel;
  assignedToId: string | null;
  notes: string | null;
  lastContactAt: string | null;
  nextActionAt: string | null;
  createdAt: string;
  updatedAt: string;
  company: Company;
  assignedTo?: User | null;
  interactions?: LeadInteraction[];
}

export interface LeadQuery {
  city?: string;
  uf?: string;
  cnae?: string;
  status?: LeadStatus;
  potentialLevel?: PotentialLevel;
  minScore?: number;
  maxScore?: number;
  assignedToId?: string;
  search?: string;
}
