import { apiRequest } from "./api";
import type { Company, CompanyContact, CompanyQuery } from "@/types/company";
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

export type CreateCompanyContactPayload = {
  type: CompanyContact["type"];
  value: string;
  source?: CompanyContact["source"];
  isPrimary?: boolean;
  active?: boolean;
};

export type UpdateCompanyContactPayload = Partial<
  Pick<CompanyContact, "value" | "source" | "isPrimary" | "active">
>;

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
  getContacts: (id: string) => apiRequest<CompanyContact[]>(`/companies/${id}/contacts`),
  createContact: (id: string, payload: CreateCompanyContactPayload) =>
    apiRequest<CompanyContact>(`/companies/${id}/contacts`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateContact: (id: string, contactId: string, payload: UpdateCompanyContactPayload) =>
    apiRequest<CompanyContact>(`/companies/${id}/contacts/${contactId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
};
