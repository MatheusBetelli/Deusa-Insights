import test from "node:test";
import assert from "node:assert/strict";
import { CitiesService } from "./cities.service";

test("CitiesService - findAll retorna lista ordenada de cidades", async () => {
  const fakePrisma = {
    city: {
      findMany: async () => [
        { id: "1", name: "Bastos", uf: "SP", isActive: true },
        { id: "2", name: "Tupã", uf: "SP", isActive: true },
      ],
    },
  };

  const service = new CitiesService(fakePrisma as never);
  const cities = await service.findAll();

  assert.ok(Array.isArray(cities));
  assert.equal(cities.length, 2);
  assert.equal(cities[0].name, "Bastos");
});

test("CitiesService - create adiciona nova cidade", async () => {
  const fakePrisma = {
    city: {
      create: async ({ data }: { data: Record<string, unknown> }) => ({ id: "c3", ...data }),
    },
  };

  const service = new CitiesService(fakePrisma as never);
  const newCity = await service.create({ name: "Marília", uf: "SP" });

  assert.equal(newCity.id, "c3");
  assert.equal(newCity.name, "Marília");
});
