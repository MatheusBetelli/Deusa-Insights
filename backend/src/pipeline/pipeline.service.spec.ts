import test from "node:test";
import assert from "node:assert/strict";
import { PipelineService } from "./pipeline.service";
import { DashboardService } from "../dashboard/dashboard.service";

const admin = { sub: "admin-1", role: "ADMIN" };
type Query = { where: Record<string, unknown>; skip?: number; take?: number; orderBy?: unknown };

function fixture() {
  const queries: Record<string, Query[]> = { clients: [], companies: [] };
  const accounts = [
    {
      id: "account-1",
      razaoSocial: "Cliente oficial",
      nomeFantasia: null,
      cidade: "Garça",
      company: { lead: { id: "lead-1", status: "NEW", assignedTo: null } },
    },
    {
      id: "account-2",
      razaoSocial: "Cliente sem lead",
      nomeFantasia: null,
      cidade: null,
      company: null,
    },
  ];
  const companies = [
    {
      id: "company-1",
      razaoSocial: "Mercado interessado legado",
      nomeFantasia: null,
      cidade: "Garça",
      lead: { id: "lead-2", status: "INTERESTED", assignedTo: null },
    },
    {
      id: "company-2",
      razaoSocial: "Conversão sem carteira",
      nomeFantasia: null,
      cidade: "Garça",
      lead: { id: "lead-3", status: "CONVERTED", assignedTo: null },
    },
    {
      id: "company-3",
      razaoSocial: "Mercado sem lead",
      nomeFantasia: null,
      cidade: "Garça",
      lead: null,
    },
  ];
  const prisma = {
    clientAccount: {
      count: async (args: Query) => {
        queries.clients.push(args);
        return accounts.length;
      },
      findMany: async (args: Query) => {
        queries.clients.push(args);
        return accounts.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? accounts.length));
      },
    },
    company: {
      count: async (args: Query) => {
        queries.companies.push(args);
        return companies.length;
      },
      findMany: async (args: Query) => {
        queries.companies.push(args);
        return companies.slice(args.skip ?? 0, (args.skip ?? 0) + (args.take ?? companies.length));
      },
      groupBy: async () => [],
    },
    lead: { count: async () => 0, groupBy: async () => [] },
    city: { count: async () => 0 },
    cnae: { count: async () => 0 },
    profile: { findMany: async () => [] },
    $transaction: async <T>(run: (tx: unknown) => Promise<T>, options: unknown): Promise<T> => {
      assert.deepEqual(options, { isolationLevel: "RepeatableRead" });
      return run(prisma);
    },
  };
  return { prisma, queries, service: new PipelineService(prisma as never) };
}

test("funil confirma pela carteira oficial, incluindo cliente sem lead, e ignora status legado", async () => {
  const { service, queries } = fixture();
  const result = await service.findAll({}, admin);
  assert.deepEqual(Object.keys(result.stages), ["NEW", "CONVERTED"]);
  assert.equal(result.stages.CONVERTED.total, 2);
  assert.equal(result.stages.NEW.total, 3);
  assert.equal(result.total, 5);
  assert.equal(result.stages.CONVERTED.conversionRate, 40);
  assert.equal(result.stages.NEW.conversionRate, 60);
  assert.deepEqual(
    result.stages.CONVERTED.items.map((item) => item.id),
    ["account:account-1", "account:account-2"],
  );
  assert.equal(result.stages.CONVERTED.items[1].leadId, null);
  assert.equal(result.stages.CONVERTED.items[0].status, "CONVERTED");
  assert.ok(result.stages.NEW.items.every((item) => item.status === "NEW"));
  assert.equal(result.stages.NEW.items[2].leadId, null);
  assert.equal(queries.clients[0].where.isCurrentClient, true);
  assert.doesNotMatch(JSON.stringify(queries.companies[0].where), /"status"/);
  assert.match(JSON.stringify(queries.companies[0].where), /"none":{"isCurrentClient":true}/);
});

test("funil e Central usam os mesmos filtros de carteira, período, CNAE e acesso", async () => {
  const { service, queries, prisma } = fixture();
  const query = {
    period: "selected_month" as const,
    month: 3,
    year: 2024,
    city: "Garça",
    uf: "SP",
    cnae: "4712100",
    assignedToId: "profile-1",
  };
  const actor = { sub: "sales-1", email: "sales@example.com", role: "SALES" };
  await new DashboardService(prisma as never).summary(query, actor);
  const centralClients = queries.clients[0].where;
  const centralOpportunities = queries.companies[0].where;
  queries.clients.length = 0;
  queries.companies.length = 0;
  const pipeline = await service.findAll(query, actor);
  assert.deepEqual(queries.clients[0].where, centralClients);
  assert.deepEqual(queries.companies[0].where, centralOpportunities);
  assert.match(JSON.stringify(centralClients), /assignedToId_legacy/);
  assert.match(JSON.stringify(centralClients), /sales@example.com/);
  assert.match(JSON.stringify(centralClients), /profile-1/);
  assert.match(JSON.stringify(centralClients), /4712-1\/00/);
  assert.equal(pipeline.period.end, "2024-04-01T00:00:00.000Z");
});

test("paginação conserva todas as contas oficiais com ordem estável e o mesmo filtro do total", async () => {
  const { service, queries } = fixture();
  const result = await service.findStage("CONVERTED", { page: 2, pageSize: 1 }, admin);
  assert.equal(result.total, 2);
  assert.equal(result.totalPages, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, "account:account-2");
  assert.deepEqual(queries.clients[0].where, queries.clients[1].where);
  assert.equal(queries.clients[1].skip, 1);
  assert.equal(queries.clients[1].take, 1);
  assert.deepEqual(queries.clients[1].orderBy, [{ razaoSocial: "asc" }, { id: "asc" }]);
});

test("busca não amplia acesso e pesquisa cliente sem depender de company ou lead", async () => {
  const { service, queries } = fixture();
  await service.findAll(
    { search: "  Mercado  ", city: "Garça" },
    {
      sub: "sales-1",
      role: "SALES",
      email: "sales@example.com",
    },
  );
  for (const captured of [queries.clients[0].where, queries.companies[0].where]) {
    assert.match(JSON.stringify(captured), /sales@example.com/);
    assert.match(JSON.stringify(captured), /Garça/);
    assert.match(JSON.stringify(captured), /"contains":"Mercado"/);
    assert.doesNotMatch(JSON.stringify(captured), /"cnpj"/);
  }
  const clauses = queries.clients[0].where.AND as Array<Record<string, unknown>>;
  assert.ok(Array.isArray(clauses[1].OR));
  assert.ok(
    (clauses[1].OR as Array<Record<string, unknown>>).some((item) => "razaoSocial" in item),
  );
});

test("filtros Todos/Todas equivalem à visão sem filtro", async () => {
  const plain = fixture();
  const all = fixture();
  await plain.service.findAll({}, admin);
  await all.service.findAll({ uf: "Todos", city: "Todas", cnae: "Todos" }, admin);
  assert.deepEqual(all.queries.clients[0].where, plain.queries.clients[0].where);
  assert.deepEqual(all.queries.companies[0].where, plain.queries.companies[0].where);
});

test("não apresenta etapas intermediárias não validadas nem aceita etapa arbitrária", async () => {
  const { service } = fixture();
  for (const status of ["CONTACTED", "INTERESTED", "LINK_B2B_SENT", "NEGOTIATION", "INVALID"]) {
    await assert.rejects(service.findStage(status, {}, admin), /Etapa de funil inválida/);
  }
});
