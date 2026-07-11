import { apiRequest, apiTextRequest } from "./api";
import type {
  CreateLeadInteractionPayload,
  Lead,
  LeadInteraction,
  LeadQuery,
  UpdateLeadPayload,
} from "@/types/lead";
import type { PaginatedResponse } from "@/types/pagination";

export const leadsService = {
  getLeads: (query?: LeadQuery) => apiRequest<Lead[]>("/leads", {}, query),
  getLeadsPage: (query?: LeadQuery) => apiRequest<PaginatedResponse<Lead>>("/leads", {}, query),
  getLead: (id: string) => apiRequest<Lead>(`/leads/${id}`),
  updateLead: (id: string, payload: UpdateLeadPayload) =>
    apiRequest<Lead>(`/leads/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  convertLead: (id: string) => apiRequest<Lead>(`/leads/${id}/convert`, { method: "POST" }),
  discardLead: (id: string) => apiRequest<Lead>(`/leads/${id}/discard`, { method: "POST" }),
  getInteractions: (id: string) => apiRequest<LeadInteraction[]>(`/leads/${id}/interactions`),
  createInteraction: (id: string, payload: CreateLeadInteractionPayload) =>
    apiRequest<LeadInteraction>(`/leads/${id}/interactions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createLead: (payload: { companyId: string }) =>
    apiRequest<Lead>("/leads", { method: "POST", body: JSON.stringify(payload) }),
  exportCsv: (query?: LeadQuery) => apiTextRequest("/leads/export.csv", {}, query),
};
