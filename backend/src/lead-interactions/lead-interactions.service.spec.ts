import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { LeadInteractionsService } from "./lead-interactions.service";

const salesActor = {
  sub: "sales-1",
  email: "sales@example.com",
  role: "SALES",
};

const managerActor = {
  sub: "manager-1",
  email: "manager@example.com",
  role: "MANAGER",
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

test("atividades comerciais retorna campos do mercado, responsável e paginação", async () => {
  let capturedWhere: unknown;
  let capturedQuery: { orderBy?: unknown; skip?: number; take?: number } | undefined;
  const interaction = {
    id: "interaction-1",
    leadId: "lead-1",
    type: "EMAIL",
    description: "Histórico antigo preservado",
    createdAt: new Date("2026-09-10T17:32:00.000Z"),
    nextContactAt: null,
    followUpCompletedAt: null,
    lead: {
      id: "lead-1",
      lastContactAt: null,
      company: {
        id: "company-1",
        nomeFantasia: "Mercado Ferrugem",
        razaoSocial: "Mercado Ferrugem LTDA",
        cidade: "Araçatuba",
      },
    },
    user: { id: "profile-1", name: "Bruno", email: "bruno@example.com", role: "SALES" },
    userLegacy: null,
  };
  const prisma = {
    leadInteraction: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 3;
      },
      findMany: async (args: { orderBy: unknown; skip: number; take: number }) => {
        capturedQuery = args;
        return [interaction];
      },
    },
    userMapping: { findUnique: async () => ({ uuid: "profile-1" }) },
    user: { findUnique: async () => null },
    profile: { findUnique: async () => null },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  const result = await new LeadInteractionsService(prisma as never).findCommercialActivities(
    {
      page: 2,
      pageSize: 1,
      company: "Ferrugem",
      city: "Araçatuba",
      type: "EMAIL",
      responsibleId: "legacy-1",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-10",
    },
    managerActor,
  );

  assert.deepEqual(result.items[0], {
    interactionId: "interaction-1",
    leadId: "lead-1",
    companyId: "company-1",
    companyName: "Mercado Ferrugem",
    city: "Araçatuba",
    type: "EMAIL",
    description: "Histórico antigo preservado",
    createdAt: interaction.createdAt,
    lastContactAt: null,
    nextContactAt: null,
    followUpCompletedAt: null,
    responsibleProfileId: "profile-1",
    responsibleName: "Bruno",
  });
  assert.equal(result.total, 3);
  assert.equal(result.page, 2);
  assert.equal(result.pageSize, 1);
  assert.equal(result.totalPages, 3);
  assert.deepEqual(capturedQuery?.orderBy, [{ createdAt: "desc" }, { id: "desc" }]);
  assert.equal(capturedQuery?.skip, 1);
  assert.equal(capturedQuery?.take, 1);
  assert.match(JSON.stringify(capturedWhere), /Ferrugem/);
  assert.match(JSON.stringify(capturedWhere), /Araçatuba/);
  assert.match(JSON.stringify(capturedWhere), /EMAIL/);
  assert.match(JSON.stringify(capturedWhere), /legacy-1/);
  assert.match(JSON.stringify(capturedWhere), /2026-09-01/);
});

test("atividades comerciais restringe vendedor à própria carteira", async () => {
  let capturedWhere: unknown;
  const prisma = {
    leadInteraction: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 0;
      },
      findMany: async () => [],
    },
    userMapping: { findUnique: async () => null },
    user: { findUnique: async () => null },
    profile: { findUnique: async () => null },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  await new LeadInteractionsService(prisma as never).findCommercialActivities({}, salesActor);

  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales-1/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);
});

test("próximos contatos filtram retornos pendentes e ordenam pelo horário agendado", async () => {
  let capturedWhere: unknown;
  let capturedOrderBy: unknown;
  const prisma = {
    leadInteraction: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 1;
      },
      findMany: async (args: { orderBy: unknown }) => {
        capturedOrderBy = args.orderBy;
        return [];
      },
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  await new LeadInteractionsService(prisma as never).findCommercialActivities(
    { view: "followups", dateFrom: "2026-09-11", dateTo: "2026-09-12" },
    managerActor,
  );

  assert.match(JSON.stringify(capturedWhere), /nextContactAt/);
  assert.match(JSON.stringify(capturedWhere), /followUpCompletedAt/);
  assert.deepEqual(capturedOrderBy, [{ nextContactAt: "asc" }, { id: "asc" }]);
});

test("filtro de responsável aceita Profile UUID e preserva o fallback legado", async () => {
  let capturedWhere: unknown;
  const profileId = "11111111-1111-4111-8111-111111111111";
  const prisma = {
    leadInteraction: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 0;
      },
      findMany: async () => [],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    userMapping: { findUnique: async () => null },
    user: { findUnique: async () => null },
    profile: { findUnique: async () => null },
  };

  await new LeadInteractionsService(prisma as never).findCommercialActivities(
    { responsibleId: profileId },
    managerActor,
  );

  assert.match(JSON.stringify(capturedWhere), new RegExp(profileId));
});

test("período invertido é rejeitado antes da consulta", async () => {
  let transactionCalls = 0;
  const prisma = {
    leadInteraction: { count: async () => 0, findMany: async () => [] },
    userMapping: { findUnique: async () => null },
    user: { findUnique: async () => null },
    profile: { findUnique: async () => null },
    $transaction: async (operations: Array<Promise<unknown>>) => {
      transactionCalls += 1;
      return Promise.all(operations);
    },
  };

  await assert.rejects(
    () =>
      new LeadInteractionsService(prisma as never).findCommercialActivities(
        { dateFrom: "2026-09-11", dateTo: "2026-09-10" },
        managerActor,
      ),
    BadRequestException,
  );
  assert.equal(transactionCalls, 0);
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
  let updatedLead: Record<string, unknown> | undefined;
  const nextContactAt = new Date("2026-09-11T13:40:00.000Z");
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
      nextContactAt,
      userId: "attacker-1",
    } as never,
    salesActor,
  );

  assert.equal(createdInteraction?.userId, "profile-1");
  assert.equal(createdInteraction?.type, "VISITA");
  assert.equal(createdInteraction?.description, "Visita registrada");
  assert.equal(createdInteraction?.nextContactAt, nextContactAt);
  assert.equal(updatedLead?.nextActionAt, nextContactAt);
});

test("concluir retorno atualiza a interação e limpa o próximo passo correspondente do lead", async () => {
  const nextContactAt = new Date("2026-09-11T13:40:00.000Z");
  let completedData: Record<string, unknown> | undefined;
  let clearedLead = false;
  const transactionClient = {
    lead: {
      findFirst: async () => ({ id: "lead-1", nextActionAt: nextContactAt }),
      updateMany: async () => {
        clearedLead = true;
        return { count: 1 };
      },
    },
    leadInteraction: {
      findFirst: async () => ({ id: "interaction-1", nextContactAt }),
      update: async (args: { data: Record<string, unknown> }) => {
        completedData = args.data;
        return { id: "interaction-1", ...args.data };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (tx: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  const result = await new LeadInteractionsService(prisma as never).completeFollowUp(
    "lead-1",
    "interaction-1",
    managerActor,
  );

  assert.equal(result.id, "interaction-1");
  assert.ok(completedData?.followUpCompletedAt instanceof Date);
  assert.equal(clearedLead, true);
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
