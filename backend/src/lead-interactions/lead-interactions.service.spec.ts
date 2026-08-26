import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { LeadInteractionsService } from "./lead-interactions.service";

const salesActor = {
  sub: "sales-1",
  email: "sales@example.com",
  role: "SALES",
};

test("consulta de interações exige acesso à carteira do lead", async () => {
  let capturedWhere: unknown;
  const prisma = {
    lead: {
      findFirst: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return { id: "lead-1" };
      },
    },
    leadInteraction: { findMany: async () => [] },
  };

  const result = await new LeadInteractionsService(prisma as never).findByLead(
    "lead-1",
    salesActor,
  );

  assert.deepEqual(result, []);
  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);
});

test("interação em lead de outra carteira falha antes de criar perfil ou registro", async () => {
  let userQueries = 0;
  const transactionClient = {
    lead: { findFirst: async () => null },
    user: {
      findUnique: async () => {
        userQueries += 1;
        return null;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  await assert.rejects(
    () =>
      new LeadInteractionsService(prisma as never).create(
        "lead-other",
        { type: "CALL", description: "Tentativa sem acesso" },
        salesActor,
      ),
    NotFoundException,
  );
  assert.equal(userQueries, 0);
});
