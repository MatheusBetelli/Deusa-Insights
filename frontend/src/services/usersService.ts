import { apiRequest } from "./api";
import type { UserSummary } from "@/types/lead";

export const usersService = {
  getUsers: () => apiRequest<UserSummary[]>("/users"),
};
