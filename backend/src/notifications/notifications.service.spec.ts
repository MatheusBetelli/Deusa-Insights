import test from "node:test";
import assert from "node:assert/strict";
import { NotificationsService } from "./notifications.service";

test("NotificationsService - getOperationalNotifications gera alertas operacionais", async () => {
  const fakePrisma = {
    lead: {
      count: async () => 5,
      findFirst: async () => ({ createdAt: new Date("2026-08-10T12:00:00Z") }),
    },
    importJob: {
      findFirst: async () => null,
      findMany: async () => [],
    },
    company: {
      count: async () => 2,
      findFirst: async () => ({ updatedAt: new Date("2026-08-11T10:00:00Z") }),
    },
  };

  const service = new NotificationsService(fakePrisma as any);
  const result = await service.getOperationalNotifications();

  assert.ok(result.length >= 1);
  assert.ok(result.some(r => r.category === "OPPORTUNITY" || r.category === "ACTION"));
  assert.ok(result[0].title.length > 0);
});
