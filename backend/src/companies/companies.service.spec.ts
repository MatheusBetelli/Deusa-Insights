import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { ContactSource, ContactType } from "@prisma/client";
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
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);
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

  await assert.rejects(() => service.update("company-1", { latitude: -22.2 }), BadRequestException);
});

test("updateCommercialProfile grava cadastro e contatos na mesma transação", async () => {
  const calls: string[] = [];
  const tx = {
    company: {
      findFirst: async () => {
        calls.push("read-company");
        return { id: "company-1" };
      },
      findUnique: async () => {
        calls.push("read-result");
        return { id: "company-1", details: { telefone: "14999999999" } };
      },
      update: async () => {
        calls.push("update-company");
        return { id: "company-1" };
      },
    },
    companyContact: {
      updateMany: async () => {
        calls.push("updateMany-contacts");
        return { count: 0 };
      },
      upsert: async () => {
        calls.push("upsert-contact");
        return { companyId: "company-1" };
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
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);

  const result = await service.updateCommercialProfile(
    "company-1",
    {
      nomeFantasia: "Mercado Teste",
      telefone: "14999999999",
    },
    { sub: "manager-1", email: "manager@example.com", role: "MANAGER" },
  );

  assert.deepEqual(calls, [
    "transaction-start",
    "read-company",
    "update-company",
    "updateMany-contacts",
    "upsert-contact",
    "read-result",
    "transaction-finish",
  ]);
  assert.equal(result?.id, "company-1");
});

test("vendedor não altera perfil comercial de empresa fora da própria carteira", async () => {
  let updateCalls = 0;
  let accessWhere: unknown;
  const tx = {
    company: {
      findFirst: async (args: { where: unknown }) => {
        accessWhere = args.where;
        return null;
      },
      update: async () => {
        updateCalls += 1;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);

  await assert.rejects(
    () =>
      service.updateCommercialProfile(
        "company-other",
        { telefone: "14999999999" },
        { sub: "sales-1", email: "sales@example.com", role: "SALES" },
      ),
    /Empresa não encontrada/,
  );
  assert.equal(updateCalls, 0);
  assert.match(JSON.stringify(accessWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(accessWhere), /sales@example\.com/);
});

test("createContact normaliza contato manual e força origem MANUAL", async () => {
  let upsertArgs: Record<string, unknown> | undefined;
  const tx = {
    companyContact: {
      updateMany: async () => ({ count: 0 }),
      upsert: async (args: Record<string, unknown>) => {
        upsertArgs = args;
        return { id: "contact-1" };
      },
    },
  };
  const prisma = {
    company: {
      findFirst: async () => ({ id: "company-1" }),
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);

  await service.createContact(
    "company-1",
    {
      type: ContactType.EMAIL,
      value: "COMERCIAL@EXAMPLE.COM",
      source: ContactSource.PUBLIC,
      isPrimary: true,
    },
    { sub: "manager-1", email: "manager@example.com", role: "MANAGER" },
  );

  const create = (upsertArgs?.create ?? {}) as Record<string, unknown>;
  assert.equal(create.value, "comercial@example.com");
  assert.equal(create.source, ContactSource.MANUAL);
  assert.equal(create.createdByLegacy, "manager-1");
  assert.equal(create.isPrimary, true);
});

test("updateContact preserva tipo e origem, normaliza valor e mantém primário único", async () => {
  let updateManyArgs: Record<string, unknown> | undefined;
  let updateArgs: Record<string, unknown> | undefined;
  const tx = {
    company: {
      findFirst: async () => ({ id: "company-1" }),
    },
    companyContact: {
      findFirst: async () => ({
        id: "contact-1",
        companyId: "company-1",
        type: ContactType.EMAIL,
        value: "antigo@example.com",
        source: ContactSource.PUBLIC,
        isPrimary: false,
        active: true,
      }),
      updateMany: async (args: Record<string, unknown>) => {
        updateManyArgs = args;
        return { count: 1 };
      },
      update: async (args: Record<string, unknown>) => {
        updateArgs = args;
        return { id: "contact-1" };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);

  await service.updateContact(
    "company-1",
    "contact-1",
    {
      value: "NOVO@EXAMPLE.COM",
      source: ContactSource.IMPORT,
      isPrimary: true,
    },
    { sub: "manager-1", email: "manager@example.com", role: "MANAGER" },
  );

  const data = (updateArgs?.data ?? {}) as Record<string, unknown>;
  assert.equal(data.value, "novo@example.com");
  assert.equal(data.isPrimary, true);
  assert.equal(data.active, true);
  assert.equal("source" in data, false);
  assert.equal("type" in data, false);
  assert.match(JSON.stringify(updateManyArgs), /company-1/);
  assert.match(JSON.stringify(updateManyArgs), /EMAIL/);
});

test("updateContact desativa contato sem reativar nem manter primário", async () => {
  let updateManyCalls = 0;
  let updateArgs: Record<string, unknown> | undefined;
  const tx = {
    company: {
      findFirst: async () => ({ id: "company-1" }),
    },
    companyContact: {
      findFirst: async () => ({
        id: "contact-1",
        companyId: "company-1",
        type: ContactType.WHATSAPP,
        value: "14999999999",
        source: ContactSource.MANUAL,
        isPrimary: true,
        active: true,
      }),
      updateMany: async () => {
        updateManyCalls += 1;
        return { count: 0 };
      },
      update: async (args: Record<string, unknown>) => {
        updateArgs = args;
        return { id: "contact-1" };
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new CompaniesService(prisma as never, {} as never, {} as never, {} as never);

  await service.updateContact(
    "company-1",
    "contact-1",
    { active: false },
    { sub: "manager-1", email: "manager@example.com", role: "MANAGER" },
  );

  const data = (updateArgs?.data ?? {}) as Record<string, unknown>;
  assert.equal(data.active, false);
  assert.equal(data.isPrimary, false);
  assert.equal(updateManyCalls, 0);
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
  const service = new CompaniesService(prisma as never, {} as never, {} as never, config as never);

  const result = await service.getLocationCandidates("company-1", true);

  assert.equal(result.apiKeyConfigured, false);
  assert.deepEqual(result.candidates, []);
  assert.equal(result.queriesExecuted.length, 1);
});
