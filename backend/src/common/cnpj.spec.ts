import test from "node:test";
import assert from "node:assert/strict";
import { onlyDigits, normalizeCnpj, formatCnpj } from "./cnpj";

test("onlyDigits remove caracteres nao numericos", () => {
  assert.equal(onlyDigits("11.222.333/0001-81"), "11222333000181");
  assert.equal(onlyDigits("ABC-123.456"), "123456");
  assert.equal(onlyDigits(""), "");
});

test("normalizeCnpj limpa e retorna os 14 digitos do CNPJ", () => {
  assert.equal(normalizeCnpj("11.222.333/0001-81"), "11222333000181");
  assert.equal(normalizeCnpj("11222333000181"), "11222333000181");
  assert.equal(normalizeCnpj("123"), "123");
});

test("formatCnpj aplica mascara padrao XX.XXX.XXX/XXXX-XX", () => {
  assert.equal(formatCnpj("11222333000181"), "11.222.333/0001-81");
  assert.equal(formatCnpj("11.222.333/0001-81"), "11.222.333/0001-81");
  assert.equal(formatCnpj("12345"), "12345");
});
