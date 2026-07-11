import type { Company } from "./company";

export type UserRole = "ADMIN" | "MANAGER" | "SALES";
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

export type UserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type LeadInteraction = {
  id: string;
  leadId: string;
  userId: string;
  type: string;
  description: string;
  createdAt: string;
  user?: UserSummary;
};

export type Lead = {
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
  assignedTo?: UserSummary | null;
  interactions?: LeadInteraction[];
};

export type LeadQuery = {
  page?: number;
  pageSize?: number;
  sortBy?: "score" | "company" | "city" | "potential" | "createdAt";
  sortOrder?: "asc" | "desc";
  city?: string;
  uf?: string;
  cnae?: string;
  status?: LeadStatus;
  potentialLevel?: PotentialLevel;
  minScore?: number;
  maxScore?: number;
  assignedToId?: string;
  search?: string;
  statusVerificacaoEndereco?: string;
  pendenteValidacao?: string;
  situacaoCadastral?: string;
};

export type UpdateLeadPayload = Partial<
  Pick<
    Lead,
    | "status"
    | "score"
    | "potentialLevel"
    | "assignedToId"
    | "notes"
    | "lastContactAt"
    | "nextActionAt"
  >
>;

export type CreateLeadInteractionPayload = {
  userId: string;
  type: string;
  description: string;
};
