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

  const service = new NotificationsService(fakePrisma as never);
  const result = await service.getOperationalNotifications({
    sub: "manager-1",
    email: "manager@example.com",
    role: "MANAGER",
  });

  assert.ok(result.length >= 1);
  assert.ok(result.some((r) => r.category === "OPPORTUNITY" || r.category === "ACTION"));
  assert.ok(result[0].title.length > 0);
});

test("notificações de vendedor não expõem importações nem leads de outras carteiras", async () => {
  const leadWheres: unknown[] = [];
  let importQueries = 0;
  const fakePrisma = {
    lead: {
      count: async (args: { where: unknown }) => {
        leadWheres.push(args.where);
        return 0;
      },
      findFirst: async () => null,
    },
    importJob: {
      findMany: async () => {
        importQueries += 1;
        return [];
      },
    },
  };

  const result = await new NotificationsService(fakePrisma as never).getOperationalNotifications({
    sub: "sales-1",
    email: "sales@example.com",
    role: "SALES",
  });

  assert.deepEqual(result, []);
  assert.equal(importQueries, 0);
  assert.match(JSON.stringify(leadWheres), /assignedToId_legacy/);
  assert.match(JSON.stringify(leadWheres), /sales@example\.com/);
});
