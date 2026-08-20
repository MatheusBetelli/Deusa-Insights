import test from "node:test";
import assert from "node:assert/strict";
import { isNonFoodBusiness } from "./non-food-filter";

test("isNonFoodBusiness não rejeita palavras comerciais que apenas contêm termos curtos", () => {
  assert.equal(isNonFoodBusiness("Sorvetes Central"), false);
  assert.equal(isNonFoodBusiness("Supermercado Perdizes"), false);
});

test("isNonFoodBusiness mantém o bloqueio quando o termo é uma palavra completa", () => {
  assert.equal(isNonFoodBusiness("Clínica Vet Animal"), true);
});
