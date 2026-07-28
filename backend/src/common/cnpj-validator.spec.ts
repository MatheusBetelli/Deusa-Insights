import test from "node:test";
import assert from "node:assert/strict";
import { isValidCnpj } from "./cnpj-validator";

test("isValidCnpj valida CNPJs reais validos", () => {
  // CNPJs validos reais
  assert.equal(isValidCnpj("11.222.333/0001-81"), true);
  assert.equal(isValidCnpj("11222333000181"), true);
  assert.equal(isValidCnpj("60.701.190/0001-04"), true);
});

test("isValidCnpj rejeita CNPJs invalidos ou malformados", () => {
  assert.equal(isValidCnpj("00000000000000"), false);
  assert.equal(isValidCnpj("11111111111111"), false);
  assert.equal(isValidCnpj("11.222.333/0001-00"), false);
  assert.equal(isValidCnpj("12345"), false);
});
