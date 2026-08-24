import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { CompaniesService } from "./companies.service";

function makeService(existing: Record<string, unknown> | null) {
  let upsertArgs: Record<string, unknown> | undefined;
  const prisma = {
    company: {
      findUnique: async () => existing,
      upsert: async (args: Record<string, unknown>) => {
        upsertArgs = args;
        return { id: "company-1", cnaes: [], lead: null };
      },
    },
  };
  const service = new CompaniesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, getUpsertArgs: () => upsertArgs };
}

test("upsertCompany preserva coordenadas já validadas", async () => {
  const { service, getUpsertArgs } = makeService({
    validadoManualmente: true,
    statusVerificacaoEndereco: "confirmado",
    latitudeVerificada: -22.2,
    longitudeVerificada: -49.6,
  });

  await service.upsertCompany({
    cnpj: "11222333000181",
    razaoSocial: "Mercado Teste",
    situacaoCadastral: "ATIVA",
    uf: "SP",
    cidade: "Garça",
    source: "receita_federal",
    latitude: -10,
    longitude: -40,
    origemCoordenada: "municipio_centroide_jitter",
  });

  const update = getUpsertArgs()?.update as Record<string, unknown>;
  assert.equal("latitude" in update, false);
  assert.equal("longitude" in update, false);
  assert.equal("origemCoordenada" in update, false);
});

test("upsertCompany bloqueia CNPJ inválido antes de gravar", async () => {
  const { service } = makeService(null);
  await assert.rejects(
    () =>
      service.upsertCompany({
        cnpj: "00000000000000",
        razaoSocial: "Inválida",
        situacaoCadastral: "ATIVA",
        uf: "SP",
        cidade: "Garça",
        source: "manual",
      }),
    BadRequestException,
  );
});

test("busca textual não cria condição CNPJ contém string vazia", () => {
  const { service } = makeService(null);
  const where = (
    service as unknown as { buildWhere: (query: { search: string }) => Record<string, unknown> }
  ).buildWhere({ search: "Mercado Central" });
  const serialized = JSON.stringify(where);

  assert.equal(serialized.includes('"cnpj"'), false);
  assert.equal(serialized.includes("Mercado Central"), true);
});

test("busca numérica mantém filtro parcial por CNPJ", () => {
  const { service } = makeService(null);
  const where = (
    service as unknown as { buildWhere: (query: { search: string }) => Record<string, unknown> }
  ).buildWhere({ search: "11.222" });
  const serialized = JSON.stringify(where);

  assert.equal(serialized.includes('"cnpj":{"contains":"11222"}'), true);
});

test("update rejeita par de coordenadas incompleto", async () => {
  const { service } = makeService(null);

  await assert.rejects(
    () => service.update("company-1", { latitude: -22.2 }),
    BadRequestException,
  );
});

test("updateCommercialProfile grava cadastro e contatos na mesma transação", async () => {
  const calls: string[] = [];
  const tx = {
    company: {
      findUnique: async (args: Record<string, unknown>) => {
        calls.push(args && "include" in args ? "read-result" : "read-company");
        return args && "include" in args
          ? { id: "company-1", details: { telefone: "14999999999" } }
          : { id: "company-1" };
      },
      update: async () => {
        calls.push("update-company");
        return { id: "company-1" };
      },
    },
    companyDetails: {
      upsert: async () => {
        calls.push("upsert-details");
        return { companyId: "company-1" };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => {
      calls.push("transaction-start");
      const result = await callback(tx);
      calls.push("transaction-finish");
      return result;
    },
  };
  const service = new CompaniesService(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const result = await service.updateCommercialProfile("company-1", {
    nomeFantasia: "Mercado Teste",
    telefone: "14999999999",
  });

  assert.deepEqual(calls, [
    "transaction-start",
    "read-company",
    "update-company",
    "upsert-details",
    "read-result",
    "transaction-finish",
  ]);
  assert.equal(result?.id, "company-1");
});

test("candidatos de localização exigem confirmação explícita", async () => {
  const { service } = makeService(null);

  await assert.rejects(
    () => service.getLocationCandidates("company-1", false),
    BadRequestException,
  );
});

test("candidatos de localização não chamam Google Places sem chave configurada", async () => {
  const company = {
    id: "company-1",
    cnpj: "11222333000181",
    razaoSocial: "Mercado Teste",
    nomeFantasia: "Mercado Teste",
    logradouro: "Rua Um",
    numero: "10",
    bairro: "Centro",
    cidade: "Garça",
    uf: "SP",
    cep: "17400000",
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4711302",
    latitude: null,
    longitude: null,
    details: null,
  };
  const prisma = { company: { findUnique: async () => company } };
  const config = { get: () => undefined };
  const service = new CompaniesService(
    prisma as never,
    {} as never,
    {} as never,
    config as never,
  );

  const result = await service.getLocationCandidates("company-1", true);

  assert.equal(result.apiKeyConfigured, false);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.queriesExecuted.length, 1);
});
