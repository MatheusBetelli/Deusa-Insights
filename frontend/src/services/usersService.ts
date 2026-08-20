import { apiRequest } from "./api";
import type { UserSummary } from "@/types/lead";

export const usersService = {
  getUsers: () => apiRequest<UserSummary[]>("/users"),
  createUser: (data: {
    name: string;
    email: string;
    password: string;
    role: "ADMIN" | "MANAGER" | "SALES";
  }) =>
    apiRequest<UserSummary>("/users", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteUser: (id: string) =>
    apiRequest<{ id: string }>(`/users/${id}`, {
      method: "DELETE",
    }),
};
