import test from "node:test";
import assert from "node:assert/strict";
import { GeocodingService } from "./geocoding.service";

test("GeocodingService - isAvailable retorna estado correto conforme chave", () => {
  const service = new GeocodingService();
  const oldKey = process.env.GOOGLE_MAPS_API_KEY;

  delete process.env.GOOGLE_MAPS_API_KEY;
  assert.equal(service.isAvailable(), false);
  assert.equal(service.getMaskedKey(), "Não configurada");

  process.env.GOOGLE_MAPS_API_KEY = "AIzaSyTEST1234567890KEY";
  assert.equal(service.isAvailable(), true);
  assert.equal(service.getMaskedKey(), "AIza...0KEY");

  if (oldKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = oldKey;
});

test("GeocodingService - geocodeAndVerify retorna null sem chave", async () => {
  const service = new GeocodingService();
  const oldKey = process.env.GOOGLE_MAPS_API_KEY;
  delete process.env.GOOGLE_MAPS_API_KEY;

  const result = await service.geocodeAndVerify({
    cidade: "Garça",
    uf: "SP",
    logradouro: "Rua Paraná",
  });

  assert.equal(result, null);

  if (oldKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = oldKey;
});

test("geocodeAndVerify não chama API com entrada insuficiente e não amplifica HTTP 429", async () => {
  const originalKey = process.env.GOOGLE_MAPS_API_KEY;
  const originalFetch = globalThis.fetch;
  process.env.GOOGLE_MAPS_API_KEY = "test-key-not-used-externally";

  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("rate limited", { status: 429 });
  }) as typeof fetch;

  try {
    const service = new GeocodingService();
    service.onModuleInit();

    assert.equal(await service.geocodeAndVerify({ cidade: "Garça", uf: "SP" }), null);
    assert.equal(calls, 0);

    assert.equal(
      await service.geocodeAndVerify({
        nomeFantasia: "Mercado Teste",
        cidade: "Garça",
        uf: "SP",
      }),
      null,
    );
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = originalKey;
  }
});
