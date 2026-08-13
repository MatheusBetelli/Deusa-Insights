import assert from "node:assert";
import { test } from "node:test";
import {
  formatCnpj,
  formatCnae,
  formatDateTime,
  companyName,
  statusLabels,
  potentialLabels,
} from "./commercial-formatters";

test("formatCnpj aplica mascara XX.XXX.XXX/XXXX-XX corretamente", () => {
  assert.strictEqual(formatCnpj("12345678000195"), "12.345.678/0001-95");
  assert.strictEqual(formatCnpj("12.345.678/0001-95"), "12.345.678/0001-95");
});

test("formatCnpj retorna 'Não disponível' para CNPJs inválidos, incompletos ou IDs externos", () => {
  assert.strictEqual(formatCnpj("123456"), "Não disponível");
  assert.strictEqual(formatCnpj(""), "Não disponível");
  assert.strictEqual(formatCnpj("G-ChIJ123456"), "Não disponível");
});

test("formatCnae aplica mascara XXXX-X/XX para CNAEs com 7 digitos", () => {
  assert.strictEqual(formatCnae("4712100"), "4712-1/00");
  assert.strictEqual(formatCnae("4712-1/00"), "4712-1/00");
});

test("formatCnae lida com valores ausentes ou incompletos", () => {
  assert.strictEqual(formatCnae(null), "-");
  assert.strictEqual(formatCnae(""), "-");
  assert.strictEqual(formatCnae("123"), "123");
});

test("formatDateTime formata strings ISO de data/hora ou trata nulos", () => {
  assert.strictEqual(formatDateTime(null), "Sem registro");
  assert.strictEqual(formatDateTime(""), "Sem registro");
  const formatted = formatDateTime("2026-07-28T14:30:00.000Z");
  assert.ok(typeof formatted === "string" && formatted !== "Sem registro");
});

test("companyName prioriza nomeFantasia e faz fallback para razaoSocial", () => {
  assert.strictEqual(
    companyName({ nomeFantasia: "Supermercado Deusa", razaoSocial: "Deusa Alimentos LTDA" }),
    "Supermercado Deusa",
  );
  assert.strictEqual(
    companyName({ nomeFantasia: null, razaoSocial: "Deusa Alimentos LTDA" }),
    "Deusa Alimentos LTDA",
  );
  assert.strictEqual(
    companyName({ nomeFantasia: "", razaoSocial: "Deusa Alimentos LTDA" }),
    "Deusa Alimentos LTDA",
  );
});

test("statusLabels e potentialLabels contem mapeamentos legiveis em portugues", () => {
  assert.strictEqual(statusLabels.NEW, "Novo");
  assert.strictEqual(statusLabels.CONVERTED, "Convertido");
  assert.strictEqual(potentialLabels.HIGH, "Alto");
  assert.strictEqual(potentialLabels.CRITICAL, "Crítico");
});
