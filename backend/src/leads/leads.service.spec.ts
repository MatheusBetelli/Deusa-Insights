import test from "node:test";
import assert from "node:assert/strict";
import { LeadsService } from "./leads.service";

type AccountUpsertArgs = {
  where: { codigoClienteDeusa: string };
  create: { cnpj: string; importedFromExcel: boolean };
};

test("convert grava lead e cliente de forma atômica com identificador idempotente", async () => {
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
  let accountUpsert: AccountUpsertArgs | undefined;
  const transactionClient = {
    lead: {
      update: async () => ({ id: "lead-1", company }),
    },
    clientAccount: {
      findFirst: async () => null,
      update: async () => ({}),
      upsert: async (args: AccountUpsertArgs) => {
        accountUpsert = args;
        return {};
      },
    },
  };
  const prisma = {
    lead: {
      findUnique: async () => ({
        id: "lead-1",
        companyId: company.id,
        status: "NEW",
        company,
        assignedTo: null,
        interactions: [],
      }),
    },
    $transaction: async (callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
  };

  await new LeadsService(prisma as never).convert("lead-1");

  assert.equal(accountUpsert?.where.codigoClienteDeusa, "LEAD-company-1");
  assert.equal(accountUpsert?.create.cnpj, "11222333000181");
  assert.equal(accountUpsert?.create.importedFromExcel, false);
});
