import test from "node:test";
import assert from "node:assert/strict";
import { CnaesService } from "./cnaes.service";

test("CnaesService - findAll lista CNAEs alvo", async () => {
  const fakePrisma = {
    cnae: {
      findMany: async () => [
        { id: "1", code: "4712100", description: "Minimercados", isTarget: true },
        { id: "2", code: "4711302", description: "Supermercados", isTarget: true },
      ],
    },
  };

  const service = new CnaesService(fakePrisma as any);
  const result = (await service.findAll()) as any[];

  assert.equal(result.length, 2);
  assert.equal(result[0].code, "4712100");
});

test("CnaesService - create cria novo CNAE formatando código", async () => {
  const fakePrisma = {
    cnae: {
      create: async ({ data }: any) => ({ id: "c1", ...data }),
    },
  };

  const service = new CnaesService(fakePrisma as any);
  const res = await service.create({
    code: "47.12-1/00",
    description: "Minimercados, mercearias e armazéns",
    isTarget: true,
  });

  assert.equal(res.code, "4712100");
});
