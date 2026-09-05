import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
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

test("histórico de interações é consultado da mais recente para a mais antiga", async () => {
  let capturedOrderBy: unknown;
  const prisma = {
    lead: { findFirst: async () => ({ id: "lead-1" }) },
    leadInteraction: {
      findMany: async (args: { orderBy: unknown }) => {
        capturedOrderBy = args.orderBy;
        return [];
      },
    },
  };

  await new LeadInteractionsService(prisma as never).findByLead("lead-1", salesActor);

  assert.deepEqual(capturedOrderBy, { createdAt: "desc" });
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

test("interação não pode confirmar cliente real por status manual", async () => {
  let transactionCalls = 0;
  const prisma = {
    $transaction: async () => {
      transactionCalls += 1;
    },
  };

  await assert.rejects(
    () =>
      new LeadInteractionsService(prisma as never).create(
        "lead-1",
        {
          type: "STATUS_CHANGE",
          description: "Tentativa de conversão manual",
          newStatus: "CONVERTED" as never,
        },
        salesActor,
      ),
    BadRequestException,
  );
  assert.equal(transactionCalls, 0);
});

test("B2B_LINK_SENT registra interação e avança o lead para LINK_B2B_SENT", async () => {
  let createdInteraction: Record<string, unknown> | undefined;
  let updatedLead: Record<string, unknown> | undefined;
  const transactionClient = {
    lead: {
      findFirst: async () => ({ id: "lead-1", status: "INTERESTED" }),
      updateMany: async (args: { data: Record<string, unknown> }) => {
        updatedLead = args.data;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async () => ({
        id: "sales-1",
        email: "sales@example.com",
        name: "Sales",
        role: "SALES",
      }),
    },
    profile: {
      upsert: async () => ({ id: "profile-1" }),
    },
    userMapping: {
      upsert: async () => ({ cuid: "sales-1", uuid: "profile-1" }),
    },
    leadInteraction: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdInteraction = args.data;
        return { id: "interaction-1", ...args.data };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  await new LeadInteractionsService(prisma as never).create(
    "lead-1",
    { type: "B2B_LINK_SENT", description: "Link enviado pelo WhatsApp" },
    salesActor,
  );

  assert.equal(createdInteraction?.type, "B2B_LINK_SENT");
  assert.equal(createdInteraction?.userId, "profile-1");
  assert.equal(updatedLead?.status, "LINK_B2B_SENT");
});

test("cliente confirmado não pode ter status alterado por interação B2B manual", async () => {
  let userQueries = 0;
  const transactionClient = {
    lead: {
      findFirst: async () => ({ id: "lead-1", status: "CONVERTED" }),
    },
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
        "lead-1",
        { type: "B2B_LINK_SENT", description: "Tentativa manual" },
        salesActor,
      ),
    BadRequestException,
  );
  assert.equal(userQueries, 0);
});

test("ação comercial usa o usuário autenticado e não aceita userId do formulário", async () => {
  let createdInteraction: Record<string, unknown> | undefined;
  const transactionClient = {
    lead: {
      findFirst: async () => ({ id: "lead-1", status: "INTERESTED" }),
      updateMany: async () => ({ count: 1 }),
    },
    user: {
      findUnique: async () => ({
        id: "sales-1",
        email: "sales@example.com",
        name: "Sales",
        role: "SALES",
      }),
    },
    profile: { upsert: async () => ({ id: "profile-1" }) },
    userMapping: { upsert: async () => ({ cuid: "sales-1", uuid: "profile-1" }) },
    leadInteraction: {
      create: async (args: { data: Record<string, unknown> }) => {
        createdInteraction = args.data;
        return { id: "interaction-1", ...args.data };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  await new LeadInteractionsService(prisma as never).createCommercialAction(
    "lead-1",
    {
      type: "VISITA",
      description: "Visita registrada",
      userId: "attacker-1",
    } as never,
    salesActor,
  );

  assert.equal(createdInteraction?.userId, "profile-1");
  assert.equal(createdInteraction?.type, "VISITA");
  assert.equal(createdInteraction?.description, "Visita registrada");
});

test("ação comercial em lead fora da carteira não cria interação", async () => {
  let createCalls = 0;
  const transactionClient = {
    lead: { findFirst: async () => null },
    leadInteraction: { create: async () => createCalls++ },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  await assert.rejects(
    () =>
      new LeadInteractionsService(prisma as never).createCommercialAction(
        "lead-other",
        { type: "WHATSAPP" as never },
        salesActor,
      ),
    NotFoundException,
  );
  assert.equal(createCalls, 0);
});
