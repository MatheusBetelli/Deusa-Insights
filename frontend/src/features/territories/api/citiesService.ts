import { apiRequest } from "@/services/api";
import type { City } from "@/features/territories/types/city";
import type { PaginatedResponse } from "@/types/pagination";

export type CityQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  uf?: string;
  sortBy?: "name" | "uf" | "companyCount";
  sortOrder?: "asc" | "desc";
};

export const citiesService = {
  getCities: () => apiRequest<City[]>("/cities"),
  getCitiesPage: (query?: CityQuery) => apiRequest<PaginatedResponse<City>>("/cities", {}, query),
};
