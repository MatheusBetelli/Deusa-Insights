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

  if (oldKey) process.env.GOOGLE_MAPS_API_KEY = oldKey;
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

  if (oldKey) process.env.GOOGLE_MAPS_API_KEY = oldKey;
});
