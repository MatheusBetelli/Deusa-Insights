import test from "node:test";
import assert from "node:assert/strict";
import { PipelineService } from "./pipeline.service";

test("findStage mantém total e paginação do conjunto consultado", async () => {
  let capturedWhere: unknown;
  const company = {
    cnpj: "11222333000181",
    razaoSocial: "Supermercado Teste",
    nomeFantasia: "Supermercado Teste",
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4711302",
    cidade: "Garça",
    uf: "SP",
    latitude: -22.21,
    longitude: -49.65,
  };
  const prisma = {
    lead: {
      count: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return 12;
      },
      findMany: async () => [
        {
          id: "lead-1",
          status: "NEW",
          score: 10,
          potentialLevel: "LOW",
          createdAt: new Date(),
          company,
          assignedTo: null,
        },
      ],
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  };

  const result = await new PipelineService(prisma as never).findStage(
    "NEW",
    {
      page: 1,
      pageSize: 10,
    },
    {
      sub: "sales-1",
      email: "sales@example.com",
      role: "SALES",
    },
  );

  assert.equal(result.total, 12);
  assert.equal(result.totalPages, 2);
  assert.equal(result.items.length, 1);
  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);
});
