import { apiRequest } from "./api";
import type { UserSummary } from "@/types/lead";

export const usersService = {
  getUsers: () => apiRequest<UserSummary[]>("/users"),
  createInvitation: (data: { name: string; email: string; role: "ADMIN" | "MANAGER" | "SALES" }) =>
    apiRequest<UserSummary & { inviteSent: boolean; expiresAt: string }>("/users/invitations", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  resendInvitation: (id: string) =>
    apiRequest<UserSummary & { inviteSent: boolean; expiresAt: string }>(
      `/users/${id}/invitation/resend`,
      { method: "POST" },
    ),
  deleteUser: (id: string) =>
    apiRequest<{ id: string }>(`/users/${id}`, {
      method: "DELETE",
    }),
};
