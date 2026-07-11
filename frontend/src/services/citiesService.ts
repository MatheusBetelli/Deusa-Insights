import { apiRequest } from "./api";
import type { City } from "@/types/city";
import type { PaginatedResponse } from "@/types/pagination";

export type CityQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: "name" | "uf" | "companyCount";
  sortOrder?: "asc" | "desc";
};

export const citiesService = {
  getCities: () => apiRequest<City[]>("/cities"),
  getCitiesPage: (query?: CityQuery) => apiRequest<PaginatedResponse<City>>("/cities", {}, query),
};
