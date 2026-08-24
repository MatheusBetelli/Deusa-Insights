import test from "node:test";
import assert from "node:assert/strict";
import { parseSemicolonCsvLine, ReceitaFederalProvider } from "./receita-federal.provider";

test("parseSemicolonCsvLine preserva separadores e aspas dentro de campos", () => {
  assert.deepEqual(parseSemicolonCsvLine('"123";"Mercado; Central";"Rua ""A"""'), [
    "123",
    "Mercado; Central",
    'Rua "A"',
  ]);
});

test("provider não pré-carrega CSV quando o dataset está congelado", async () => {
  const values: Record<string, string> = {
    NODE_ENV: "production",
    ENABLE_LEAD_MUTATIONS: "false",
  };
  const config = {
    get: (key: string) => values[key],
  };
  const provider = new ReceitaFederalProvider(config as never);
  let cacheLoads = 0;
  Object.assign(provider, {
    ensureCache: async () => {
      cacheLoads += 1;
    },
  });

  await provider.onModuleInit();

  assert.equal(cacheLoads, 0);
});
