import { apiRequest } from "./api";

export interface AppNotification {
  id: string;
  type: "HIGH_SCORE_UNASSIGNED" | "IMPORT_COMPLETED" | "ACTION_REQUIRED" | "PIPELINE_UPDATE";
  title: string;
  message: string;
  createdAt: string;
  targetUrl: string;
  category: "OPPORTUNITY" | "IMPORT" | "ACTION";
}

export const notificationsService = {
  getNotifications: () => apiRequest<AppNotification[]>("/notifications"),
};
