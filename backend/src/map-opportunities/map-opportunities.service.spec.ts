import assert from "node:assert/strict";
import test from "node:test";
import { MapOpportunitiesService } from "./map-opportunities.service";

test("mapa detalhado aplica escopo de carteira para vendedor", async () => {
  let capturedWhere: unknown;
  const prisma = {
    lead: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return [];
      },
    },
  };

  const result = await new MapOpportunitiesService(prisma as never).findAll({
    sub: "sales-1",
    email: "sales@example.com",
    role: "SALES",
  });

  assert.deepEqual(result, []);
  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);
});
