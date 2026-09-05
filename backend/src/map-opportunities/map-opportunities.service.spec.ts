import assert from "node:assert/strict";
import test from "node:test";
import { MapOpportunitiesService } from "./map-opportunities.service";

test("mapa detalhado aplica escopo de carteira para vendedor", async () => {
  let capturedWhere: unknown;
  const prisma = {
    lead: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return [];
      },
    },
  };

  const result = await new MapOpportunitiesService(prisma as never).findAll({
    sub: "sales-1",
    email: "sales@example.com",
    role: "SALES",
  });

  assert.deepEqual(result, []);
  assert.match(JSON.stringify(capturedWhere), /assignedToId_legacy/);
  assert.match(JSON.stringify(capturedWhere), /sales@example\.com/);
});

test("mapa preserva coordenada ajustada manualmente mesmo com qualidade cadastral divergente", async () => {
  const prisma = {
    lead: {
      findMany: async () => [
        {
          id: "lead-client-1",
          companyId: "company-1",
          status: "CONVERTED",
          score: 100,
          potentialLevel: "HIGH",
          company: {
            id: "company-1",
            razaoSocial: "Mercado Manual",
            nomeFantasia: "Mercado Manual",
            situacaoCadastral: "ATIVA",
            cidade: "Garça",
            uf: "SP",
            cnaePrincipal: "4711302",
            latitude: -22.205,
            longitude: -49.605,
            origemCoordenada: "coordenada_manual",
            statusVerificacaoEndereco: "divergente",
            confiancaVerificacao: 20,
            clientAccounts: [{ isCurrentClient: true }],
            contacts: [],
            details: null,
            cnaes: [],
          },
          assignedTo: null,
        },
      ],
    },
  };

  const result = await new MapOpportunitiesService(prisma as never).findAll({
    sub: "admin-1",
    role: "ADMIN",
  });

  assert.equal(result[0]?.latitude, -22.205);
  assert.equal(result[0]?.longitude, -49.605);
});

test("mapa detalhado aplica filtros server-side de região, status comercial e CNAE", async () => {
  let capturedWhere: unknown;
  const prisma = {
    lead: {
      findMany: async (args: { where: unknown }) => {
        capturedWhere = args.where;
        return [];
      },
    },
  };

  const result = await new MapOpportunitiesService(prisma as never).findAll(
    {
      sub: "sales-1",
      email: "sales@example.com",
      role: "SALES",
    },
    {
      uf: "SP",
      city: "Garça",
      search: "Mercado",
      cnae: "4712100",
      potentialLevel: "CRITICAL" as never,
      client: false,
    },
  );

  const serialized = JSON.stringify(capturedWhere);
  assert.deepEqual(result, []);
  assert.match(serialized, /Garça/);
  assert.match(serialized, /4712100/);
  assert.match(serialized, /CRITICAL/);
  assert.match(serialized, /clientAccounts/);
  assert.match(serialized, /none/);
});

test("deduplicação do mapa: unifica cliente e prospect com mesma marca no mesmo local e mantém o cliente", async () => {
  const mockLeads = [
    {
      id: "lead-prospect-1",
      status: "NEW",
      score: 65,
      potentialLevel: "HIGH",
      company: {
        id: "comp-prospect",
        razaoSocial: "Supermercados Kawakami - Bastos",
        nomeFantasia: "Supermercados Kawakami - Bastos",
        situacaoCadastral: "ATIVA",
        cidade: "Bastos",
        uf: "SP",
        cnaePrincipal: "4711302",
        latitude: -21.92025,
        longitude: -50.73837,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 80,
        clientAccounts: [],
      },
    },
    {
      id: "lead-client-1",
      status: "CONVERTED",
      score: 100,
      potentialLevel: "HIGH",
      company: {
        id: "comp-client",
        razaoSocial: "SUPERMERCADOS KAWAKAMI LTDA",
        nomeFantasia: "SUPERMERCADOS KAWAKAMI LTDA",
        situacaoCadastral: "ATIVA",
        cidade: "Bastos",
        uf: "SP",
        cnaePrincipal: "4711302",
        latitude: -21.92025,
        longitude: -50.73837,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 100,
        clientAccounts: [{ isCurrentClient: true }],
      },
    },
  ];

  const prisma = {
    lead: {
      findMany: async () => mockLeads,
    },
  };

  const service = new MapOpportunitiesService(prisma as never);
  const result = await service.findAll({ sub: "admin-1", role: "ADMIN" });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "lead-client-1");
  assert.equal(result[0].companyName, "SUPERMERCADOS KAWAKAMI LTDA");
  assert.equal(result[0].isClient, true);
});

test("deduplicação do mapa: preserva dois supermercados vizinhos de marcas diferentes", async () => {
  const mockLeads = [
    {
      id: "lead-japao",
      status: "NEW",
      score: 75,
      potentialLevel: "HIGH",
      company: {
        id: "comp-japao",
        razaoSocial: "Supermercado Japão",
        nomeFantasia: "Supermercado Japão",
        situacaoCadastral: "ATIVA",
        cidade: "Bastos",
        uf: "SP",
        cnaePrincipal: "4711302",
        latitude: -21.9201,
        longitude: -50.7382,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 90,
        clientAccounts: [],
      },
    },
    {
      id: "lead-kawakami",
      status: "NEW",
      score: 80,
      potentialLevel: "HIGH",
      company: {
        id: "comp-kawakami",
        razaoSocial: "Supermercado Kawakami",
        nomeFantasia: "Supermercado Kawakami",
        situacaoCadastral: "ATIVA",
        cidade: "Bastos",
        uf: "SP",
        cnaePrincipal: "4711302",
        latitude: -21.9202,
        longitude: -50.7383,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 90,
        clientAccounts: [],
      },
    },
  ];

  const prisma = {
    lead: {
      findMany: async () => mockLeads,
    },
  };

  const service = new MapOpportunitiesService(prisma as never);
  const result = await service.findAll({ sub: "admin-1", role: "ADMIN" });

  assert.equal(result.length, 2);
  const names = result.map((r) => r.companyName);
  assert.ok(names.includes("Supermercado Japão"));
  assert.ok(names.includes("Supermercado Kawakami"));
});

test("deduplicação do mapa: unifica dois prospects não-clientes da mesma marca e mantém o de maior score", async () => {
  const mockLeads = [
    {
      id: "lead-low-score",
      status: "NEW",
      score: 50,
      company: {
        id: "comp-low",
        razaoSocial: "Mercearia Santo Antônio",
        nomeFantasia: "Mercearia Santo Antônio",
        situacaoCadastral: "ATIVA",
        cidade: "Garça",
        uf: "SP",
        cnaePrincipal: "4712100",
        latitude: -22.2105,
        longitude: -49.6505,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 70,
        clientAccounts: [],
      },
    },
    {
      id: "lead-high-score",
      status: "NEW",
      score: 85,
      company: {
        id: "comp-high",
        razaoSocial: "Supermercado Santo Antônio LTDA",
        nomeFantasia: "Supermercado Santo Antônio LTDA",
        situacaoCadastral: "ATIVA",
        cidade: "Garça",
        uf: "SP",
        cnaePrincipal: "4711302",
        latitude: -22.2105,
        longitude: -49.6505,
        origemCoordenada: "geocodificado",
        confiancaVerificacao: 95,
        clientAccounts: [],
      },
    },
  ];

  const prisma = {
    lead: {
      findMany: async () => mockLeads,
    },
  };

  const service = new MapOpportunitiesService(prisma as never);
  const result = await service.findAll({ sub: "admin-1", role: "ADMIN" });

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "lead-high-score");
  assert.equal(result[0].score, 85);
});
