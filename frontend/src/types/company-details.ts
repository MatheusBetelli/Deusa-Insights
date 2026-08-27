import type { CompanyContact } from "./company";

type CompanyClassification = {
  type: string;
  size: string;
  region: string;
  score: number;
  potentialLevel: "LOW" | "MEDIUM" | "HIGH";
};

type CompanyDetails = {
  id: string;
  companyId: string;
  naturezaJuridica: string | null;
  telefone: string | null;
  email: string | null;
  descricaoCnae: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyDetailsResponse = {
  details: CompanyDetails | null;
  contacts?: CompanyContact[];
  classification: CompanyClassification;
};

export type UpsertCompanyDetailsPayload = {
  naturezaJuridica?: string;
  telefone?: string;
  email?: string;
  descricaoCnae?: string;
};
