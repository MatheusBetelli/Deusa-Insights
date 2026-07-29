import assert from "node:assert";
import { test } from "node:test";
import {
  calcularConfiancaCadastral,
  calcularPontuacaoOportunidade,
  avaliarPendencias,
  type QualidadeInput,
} from "./cadastral-quality";

test("calcularConfiancaCadastral pontua empresa completa com score alto", () => {
  const input: QualidadeInput = {
    cnpj: "12.345.678/0001-95",
    situacaoCadastral: "ATIVA",
    nomeFantasia: "Mercado Central",
    logradouro: "Rua Das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "19000-000",
    telefone: "(18) 3333-4444",
    email: "contato@mercadocentral.com",
    cidade: "Presidente Prudente",
    cnaePrincipal: "4712100",
    origemCoordenada: "google_places",
    latitude: -22.12,
    longitude: -51.38,
  };

  const result = calcularConfiancaCadastral(input);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.statusVerificacaoEndereco, "confiavel_cadastralmente");
});

test("calcularConfiancaCadastral reduz status para aproximado quando coordenada e centroide/jitter", () => {
  const input: QualidadeInput = {
    cnpj: "12.345.678/0001-95",
    situacaoCadastral: "ATIVA",
    nomeFantasia: "Mercado Central",
    logradouro: "Rua Das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "19000-000",
    telefone: "(18) 3333-4444",
    email: "contato@mercadocentral.com",
    cidade: "Presidente Prudente",
    cnaePrincipal: "4712100",
    origemCoordenada: "municipio_centroide_jitter",
    latitude: -22.12,
    longitude: -51.38,
  };

  const result = calcularConfiancaCadastral(input);
  assert.strictEqual(result.score, 100);
  assert.strictEqual(result.statusVerificacaoEndereco, "aproximado");
});

test("calcularPontuacaoOportunidade classifica oportunidade alta para CNAE e municipio alvo", () => {
  const input: QualidadeInput = {
    cnpj: "12.345.678/0001-95",
    situacaoCadastral: "ATIVA",
    logradouro: "Rua Das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "19000-000",
    telefone: "(18) 3333-4444",
    email: "contato@mercadocentral.com",
    cidade: "Marília",
    cnaePrincipal: "4712100",
  };

  const result = calcularPontuacaoOportunidade(
    input,
    ["4712100"],
    ["Marília", "Presidente Prudente"],
    85,
  );

  assert.strictEqual(result.nivelOportunidade, "alta");
  assert.ok(result.score >= 80);
});

test("avaliarPendencias detecta campos ausentes e coordenadas aproximadas", () => {
  const input: QualidadeInput = {
    cnpj: "12.345.678/0001-95",
    situacaoCadastral: "INAPTA",
    origemCoordenada: "municipio_centroide_jitter",
    latitude: -22.12,
    longitude: -51.38,
  };

  const result = avaliarPendencias(input);
  assert.strictEqual(result.pendenteValidacao, true);
  assert.ok(result.motivosPendencia.some((m) => m.includes("Nome fantasia não informado")));
  assert.ok(result.motivosPendencia.some((m) => m.includes("Situação cadastral")));
  assert.ok(result.motivosPendencia.some((m) => m.includes("Localização aproximada")));
});
