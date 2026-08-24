import test from "node:test";
import assert from "node:assert/strict";
import { DashboardService, resolvePeriod } from "./dashboard.service";

type QueryArgs = { where: Record<string, unknown> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

test("resolvePeriod compara meses de calendário sem deslocar datas", () => {
  const period = resolvePeriod({ period: "selected_month", year: 2024, month: 3 });
  assert.equal(period.start.toISOString(), "2024-03-01T00:00:00.000Z");
  assert.equal(period.end.toISOString(), "2024-04-01T00:00:00.000Z");
  assert.equal(period.previousStart.toISOString(), "2024-02-01T00:00:00.000Z");
  assert.equal(period.previousEnd.toISOString(), "2024-03-01T00:00:00.000Z");
});

test("summary preserva CNAE e responsável ao combinar filtros de carteira", async () => {
  const companyCounts: QueryArgs[] = [];
  const clientCounts: QueryArgs[] = [];
  const leadCounts: QueryArgs[] = [];
  const prisma = {
    company: {
      count: async (args: QueryArgs) => {
        companyCounts.push(args);
        return 0;
      },
      groupBy: async () => [],
    },
    clientAccount: {
      count: async (args: QueryArgs) => {
        clientCounts.push(args);
        return 0;
      },
    },
    lead: {
      count: async (args: QueryArgs) => {
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

  const clientWhere = clientCounts[0].where;
  assert.ok(isRecord(clientWhere.company));
  assert.ok(Array.isArray(clientWhere.company.AND));
  const clientCompanyAnd = clientWhere.company.AND.filter(isRecord);
  assert.ok(
    clientCompanyAnd.some(
      (item) => isRecord(item.lead) && item.lead.assignedToId === "profile-1",
    ),
  );
  assert.ok(clientCompanyAnd.some((item) => Array.isArray(item.OR)));

  assert.equal(clientWhere.isCurrentClient, true);

  const unattendedWhere = companyCounts[0].where;
  assert.ok(Array.isArray(unattendedWhere.AND));
  assert.ok(isRecord(unattendedWhere.AND[0]));
  assert.ok(Array.isArray(unattendedWhere.AND[0].AND));

  const firstLeadWhere = leadCounts[0].where;
  assert.ok(isRecord(firstLeadWhere.company));
  assert.deepEqual(firstLeadWhere.company.clientAccounts, {
    none: { isCurrentClient: true },
  });
  const secondLeadWhere = leadCounts[1].where;
  assert.ok(secondLeadWhere.lastContactAt);
  assert.ok(Array.isArray(secondLeadWhere.OR));
  assert.ok(
    secondLeadWhere.OR.filter(isRecord).every((item) => !("lastContactAt" in item)),
  );
});
