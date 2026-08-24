import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ImportsService } from "./imports.service";

function makeEmptyService() {
  return new ImportsService({} as never, {} as never, {} as never, {} as never);
}

test("importação rejeita XLSX corrompido e formato XLS legado antes de acessar o banco", async () => {
  const service = makeEmptyService();

  await assert.rejects(
    () => service.importClientsFromExcelBuffer(Buffer.from("not-a-zip"), "clientes.xlsx"),
    BadRequestException,
  );
  await assert.rejects(
    () => service.importClientsFromExcelBuffer(Buffer.from("legacy"), "clientes.xls"),
    BadRequestException,
  );
});

test("importação Excel usa identificadores estáveis e não inventa empresas ou CNPJs", async () => {
  const buffer = Buffer.from(
    [
      "codigo,nome,cnpj",
      'CLI-1,"Mercado Vinculado","11.222.333/0001-81"',
      'CLI-2,"Mercado Sem Cadastro","60.701.190/0001-04"',
      'CLI-3,"CNPJ Inválido","00.000.000/0000-00"',
      'CLI-4,"Conflito de Vínculo","11.222.333/0001-81"',
      ',"Sem Identificador",',
    ].join("\n"),
  );

  const accountWrites: Array<Record<string, unknown>> = [];
  const leadWrites: Array<Record<string, unknown>> = [];
  const clientCountFilters: Array<Record<string, unknown>> = [];
  const transactionClient = {
    lead: {
      upsert: async (args: Record<string, unknown>) => {
        leadWrites.push(args);
        return {};
      },
    },
    clientAccount: {
      upsert: async (args: Record<string, unknown>) => {
        accountWrites.push(args);
        return {};
      },
    },
  };
  const prisma = {
    company: {
      findUnique: async ({ where }: { where: { cnpj: string } }) =>
        where.cnpj === "11222333000181" ? { id: "company-1" } : null,
    },
    clientAccount: {
      findUnique: async ({ where }: { where: { codigoClienteDeusa: string } }) =>
        where.codigoClienteDeusa === "CLI-4"
          ? { id: "account-4", companyId: "company-other", cnpj: "60701190000104" }
          : null,
      findMany: async () => {
        throw new Error("A importação não deve varrer a carteira congelada");
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        clientCountFilters.push(where);
        return 0;
      },
    },
    lead: {
      count: async () => 0,
      findMany: async () => {
        throw new Error("A importação não deve varrer oportunidades para reconciliá-las");
      },
    },
    $transaction: async (callback: (client: typeof transactionClient) => Promise<void>) =>
      callback(transactionClient),
  };
  const companiesService = {
    upsertCompany: async () => {
      throw new Error("A importação de clientes não deve criar empresas");
    },
  };

  const service = new ImportsService(
    prisma as never,
    companiesService as never,
    {} as never,
    {} as never,
  );
  const result = await service.importClientsFromExcelBuffer(buffer, "clientes.csv");

  assert.equal(result.totalLinhasProcessadas, 5);
  assert.equal(result.clientesMatcheados, 1);
  assert.equal(result.novosClientesCriados, 2);
  assert.equal(result.clientesSemEmpresaCorrespondente, 1);
  assert.equal(result.linhasIgnoradas, 3);
  assert.deepEqual(result.motivosIgnoracao, {
    cnpj_invalido: 1,
    codigo_cliente_conflitante: 1,
    identificador_ausente: 1,
  });
  assert.equal(leadWrites.length, 1);
  assert.equal(accountWrites.length, 2);
  assert.equal(clientCountFilters.length, 2);
  assert.ok(clientCountFilters.every((where) => where.isCurrentClient === true));

  const unlinkedCreate = (accountWrites[1].create ?? {}) as Record<string, unknown>;
  assert.equal(unlinkedCreate.companyId, null);
  assert.equal(unlinkedCreate.cidade, null);
  assert.equal(unlinkedCreate.uf, null);
  assert.equal(unlinkedCreate.cnpj, "60701190000104");

  const linkedLeadCreate = (leadWrites[0].create ?? {}) as Record<string, unknown>;
  assert.equal("score" in linkedLeadCreate, false);
  assert.equal("potentialLevel" in linkedLeadCreate, false);
});
