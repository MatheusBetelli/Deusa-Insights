import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { LeadsService } from "./leads.service";

test("convert bloqueia conversao manual e exige confirmacao via ERP/B2B", async () => {
  const company = {
    id: "company-1",
    cnpj: "11222333000181",
    razaoSocial: "Mercado Teste",
    nomeFantasia: "Mercado Teste",
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4711302",
    cidade: "Garça",
    uf: "SP",
    cnaes: [],
  };
  const prisma = {
    lead: {
      findFirst: async () => ({
        id: "lead-1",
        companyId: company.id,
        status: "NEW",
        company,
      }),
    },
  };

  await assert.rejects(
    () =>
      new LeadsService(prisma as never).convert("lead-1", {
        sub: "admin-1",
        email: "admin@example.com",
        role: "ADMIN",
      }),
    BadRequestException,
  );
});

test("consultas de vendedor aplicam ownership no banco", async () => {
  let capturedWhere: unknown;
  const prisma = {
    lead: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 0;
      },
      findMany: async () => [],
      findFirst: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return null;
      },
    },
    company: { findMany: async () => [] },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };
  const actor = { sub: "sales-1", email: "sales@example.com", role: "SALES" };
  const service = new LeadsService(prisma as never);

  const result = await service.findAll({}, actor);
  assert.equal(result.total, 0);
  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);

  await assert.rejects(() => service.findById("lead-other", actor), NotFoundException);
  assert.match(JSON.stringify(capturedWhere), /lead-other/);
  assert.match(JSON.stringify(capturedWhere), /sales-1/);
});

test("lead criado por vendedor é atribuído automaticamente à própria carteira", async () => {
  let createData: Record<string, unknown> | undefined;
  const prisma = {
    company: {
      findUnique: async () => ({ id: "company-1", cnaes: [] }),
    },
    cnae: { findMany: async () => [] },
    city: { findMany: async () => [] },
    userMapping: {
      findUnique: async () => ({ cuid: "sales-1", uuid: "18b82698-cbee-4f28-b39a-5947ea86092d" }),
    },
    profile: {
      findUnique: async () => ({ id: "18b82698-cbee-4f28-b39a-5947ea86092d" }),
    },
    lead: {
      create: async (args: { data: Record<string, unknown> }) => {
        createData = args.data;
        return { id: "lead-1" };
      },
    },
  };

  await new LeadsService(prisma as never).create(
    { companyId: "company-1" },
    { sub: "sales-1", email: "sales@example.com", role: "SALES" },
  );

  assert.equal(createData?.assignedToId, "18b82698-cbee-4f28-b39a-5947ea86092d");
  assert.equal(createData?.assignedToId_legacy, "sales-1");
});

test("vendedor não pode alterar responsável, score ou potencial", async () => {
  const service = new LeadsService({} as never);
  const actor = { sub: "sales-1", email: "sales@example.com", role: "SALES" };

  await assert.rejects(
    () => service.update("lead-1", { assignedToId: "profile-2" }, actor),
    ForbiddenException,
  );
  await assert.rejects(() => service.update("lead-1", { score: 100 }, actor), ForbiddenException);
});
