import test from "node:test";
import assert from "node:assert/strict";
import { ClassificationService } from "./classification.service";
import { Company } from "@prisma/client";

test("ClassificationService - classifica supermercado grande ativo corretamente", () => {
  const service = new ClassificationService();
  const company = {
    id: "1",
    cnpj: "12345678000195",
    razaoSocial: "SUPERMERCADO TESTE LTDA",
    nomeFantasia: "SUPERMERCADO TESTE",
    situacaoCadastral: "ATIVA",
    porte: "GRANDE",
    cnaePrincipal: "4711302",
    cidade: "São Paulo",
    uf: "SP",
    statusVerificacaoEndereco: "verificado",
  } as Company;

  const res = service.classifyCompany(company);

  assert.equal(res.type, "Supermercado");
  assert.equal(res.size, "Grande");
  assert.equal(res.region, "Capital Estratégica");
  assert.equal(res.potentialLevel, "HIGH");
  assert.ok(res.score >= 75);
});

test("ClassificationService - classifica CNAE de mercearia autorizado em cidade menor", () => {
  const service = new ClassificationService();
  const company = {
    id: "2",
    cnpj: "98765432000100",
    razaoSocial: "PADARIA SILVA ME",
    nomeFantasia: null,
    situacaoCadastral: "ATIVA",
    porte: "ME",
    cnaePrincipal: "4721102",
    cidade: "Garça",
    uf: "SP",
    statusVerificacaoEndereco: "aproximado",
  } as Company;

  const res = service.classifyCompany(company);

  assert.equal(res.type, "Mercearia");
  assert.equal(res.size, "Pequeno");
  assert.equal(res.region, "Região Sul/Sudeste");
  assert.ok(res.score >= 50);
});

test("ClassificationService - lida com empresa sem CNAE e sem porte", () => {
  const service = new ClassificationService();
  const company = {
    id: "3",
    cnpj: "11111111000111",
    razaoSocial: "EMPRESA DESCONHECIDA",
    nomeFantasia: null,
    situacaoCadastral: "INATIVA",
    porte: null,
    cnaePrincipal: null,
    cidade: "Recife",
    uf: "PE",
    statusVerificacaoEndereco: null,
  } as Company;

  const res = service.classifyCompany(company);

  assert.equal(res.type, "Fora do escopo");
  assert.equal(res.size, "Médio");
  assert.equal(res.region, "Recife / PE");
  assert.equal(res.potentialLevel, "LOW");
});

test("ClassificationService - não promove atacadista fora do escopo comercial", () => {
  const service = new ClassificationService();
  const company = {
    cnaePrincipal: "4639701",
    porte: "GRANDE",
    cidade: "Garça",
    uf: "SP",
    situacaoCadastral: "ATIVA",
    statusVerificacaoEndereco: "verificado",
  } as Company;

  const res = service.classifyCompany(company);
  assert.equal(res.type, "Fora do escopo");
  assert.equal(res.score, 0);
  assert.equal(res.potentialLevel, "LOW");
});
