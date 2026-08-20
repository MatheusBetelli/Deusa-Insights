import test from "node:test";
import assert from "node:assert/strict";
import { DashboardService, resolvePeriod } from "./dashboard.service";

test("resolvePeriod compara meses de calendário sem deslocar datas", () => {
  const period = resolvePeriod({ period: "selected_month", year: 2024, month: 3 });
  assert.equal(period.start.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2024-04-01T00:00:00.000Z");
  assert.equal(period.previousStart.toISOString(), "2024-02-01T00:00:00.000Z");
  assert.equal(period.previousEnd.toISOString(), "2024-03-01T00:00:00.000Z");
});

test("summary preserva CNAE e responsável ao combinar filtros de carteira", async () => {
  const companyCounts: Array<Record<string, any>> = [];
  const clientCounts: Array<Record<string, any>> = [];
  const leadCounts: Array<Record<string, any>> = [];
  const prisma = {
    company: {
      count: async (args: Record<string, any>) => {
        companyCounts.push(args);
        return 0;
      },
      groupBy: async () => [],
    },
    clientAccount: {
      count: async (args: Record<string, any>) => {
        clientCounts.push(args);
        return 0;
      },
    },
    lead: {
      count: async (args: Record<string, any>) => {
        leadCounts.push(args);
        return 0;
      },
      groupBy: async () => [],
    },
    city: { count: async () => 0 },
    cnae: { count: async () => 0 },
    profile: { findMany: async () => [] },
  };

  const service = new DashboardService(prisma as never);
  await service.summary({
    period: "selected_month",
    year: 2024,
    month: 3,
    cnae: "4712100",
    assignedToId: "profile-1",
  });

  const clientCompanyAnd = clientCounts[0].where.company.AND as Array<Record<string, any>>;
  assert.ok(clientCompanyAnd.some((item) => item.lead?.assignedToId === "profile-1"));
  assert.ok(clientCompanyAnd.some((item) => Array.isArray(item.OR)));

  const currentClientWhere = companyCounts[0].where as Record<string, any>;
  assert.ok(Array.isArray(currentClientWhere.AND));
  assert.ok(Array.isArray(currentClientWhere.OR));

  const unattendedWhere = companyCounts[1].where as Record<string, any>;
  assert.ok(Array.isArray(unattendedWhere.AND[0].AND));

  assert.deepEqual(leadCounts[0].where.company.clientAccounts, {
    none: { isCurrentClient: true },
  });
  assert.ok(leadCounts[1].where.lastContactAt);
  assert.ok(
    leadCounts[1].where.OR.every((item: Record<string, unknown>) => !("lastContactAt" in item)),
  );
});
