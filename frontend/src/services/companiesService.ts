import { apiRequest } from "./api";
import type { Company, CompanyQuery } from "@/types/company";
import type { PaginatedResponse } from "@/types/pagination";
import type { CompanyDetailsResponse, UpsertCompanyDetailsPayload } from "@/types/company-details";

export type UpdateCommercialProfilePayload = {
  telefone?: string;
  email?: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
};

export const companiesService = {
  getCompanies: (query?: CompanyQuery) => apiRequest<Company[]>("/companies", {}, query),
  getCompaniesPage: (query?: CompanyQuery) =>
    apiRequest<PaginatedResponse<Company>>("/companies", {}, query),
  getCompany: (id: string) => apiRequest<Company>(`/companies/${id}`),
  syncByCnpj: (cnpj: string) => apiRequest<Company>(`/companies/sync/${cnpj}`, { method: "POST" }),
  getCompanyDetails: (id: string) => apiRequest<CompanyDetailsResponse>(`/companies/${id}/details`),
  upsertCompanyDetails: (id: string, payload: UpsertCompanyDetailsPayload) =>
    apiRequest<CompanyDetailsResponse>(`/companies/${id}/details`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCompany: (id: string, payload: Partial<Company>) =>
    apiRequest<Company>(`/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  updateCommercialProfile: (id: string, payload: UpdateCommercialProfilePayload) =>
    apiRequest<Company>(`/companies/${id}/commercial-profile`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
