import { apiRequest } from "./api";
import type { Company, CompanyQuery } from "@/types/company";
import type { PaginatedResponse } from "@/types/pagination";

export const companiesService = {
  getCompanies: (query?: CompanyQuery) => apiRequest<Company[]>("/companies", {}, query),
  getCompaniesPage: (query?: CompanyQuery) =>
    apiRequest<PaginatedResponse<Company>>("/companies", {}, query),
  getCompany: (id: string) => apiRequest<Company>(`/companies/${id}`),
  syncByCnpj: (cnpj: string) => apiRequest<Company>(`/companies/sync/${cnpj}`, { method: "POST" }),
};
