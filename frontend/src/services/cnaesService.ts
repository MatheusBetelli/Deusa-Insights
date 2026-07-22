import { apiRequest } from "./api";
import type { Cnae } from "@/types/cnae";
import type { PaginatedResponse } from "@/types/pagination";

export type CnaeQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  uf?: string;
  sortBy?: "code" | "description" | "category" | "companyCount";
  sortOrder?: "asc" | "desc";
};

export const cnaesService = {
  getCnaes: () => apiRequest<Cnae[]>("/cnaes"),
  getCnaesPage: (query?: CnaeQuery) => apiRequest<PaginatedResponse<Cnae>>("/cnaes", {}, query),
};
