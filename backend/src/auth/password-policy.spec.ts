import assert from "node:assert/strict";
import test from "node:test";
import { STRONG_PASSWORD_PATTERN } from "./password-policy";

test("política de senha exige comprimento e quatro classes de caracteres", () => {
  assert.equal(STRONG_PASSWORD_PATTERN.test("senha-fraca"), false);
  assert.equal(STRONG_PASSWORD_PATTERN.test("SomenteLetrasLongas"), false);
  assert.equal(STRONG_PASSWORD_PATTERN.test("SenhaEmpresa#2026"), true);
});
