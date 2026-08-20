import test from "node:test";
import assert from "node:assert/strict";
import { calculateOpportunityScoreDetails, calculateLeadScore, getPotentialLevel, calculateGarcaDistance } from "./scoring";
import { PotentialLevel } from "@prisma/client";

test("calculateOpportunityScoreDetails calcula score dos 6 pilares corretamente para minimercado em Garça com cluster de vizinhos", () => {
  const result = calculateOpportunityScoreDetails({
    cnpj: "25332029000100",
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4712100",
    nomeFantasia: "Mercado Silva",
    porte: "EPP",
    cidade: "Garça",
    logradouro: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "17400000",
    telefone: "1434710000",
    latitude: -22.2131,
    longitude: -49.6553,
    neighborCount: 5,
  });

  assert.equal(result.breakdown.perfilPts, 30);
  assert.equal(result.breakdown.potencialPts, 25); // Cluster max pts (>= 5 vizinhos)
  assert.equal(result.breakdown.logisticaPts, 20); // 0km de Garça
  assert.equal(result.breakdown.dadosPts, 10);
  assert.equal(result.breakdown.prontidaoPts, 10);
  assert.equal(result.breakdown.territorioPts, 5);
  assert.equal(result.score, 100);
  assert.equal(result.level, PotentialLevel.CRITICAL);
});

test("calculateOpportunityScoreDetails limita o score e garante nível LOW para CNAEs não-alvo (ex: oficinas, farmácias)", () => {
  const result = calculateOpportunityScoreDetails({
    cnpj: "25332029000100",
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4520000", // Manutenção de veículos
    nomeFantasia: "Auto Peças Silva",
    porte: "EPP",
    cidade: "Garça",
    logradouro: "Rua das Flores",
    numero: "100",
    bairro: "Centro",
    cep: "17400000",
    telefone: "1434710000",
    latitude: -22.2131,
    longitude: -49.6553,
  });

  assert.equal(result.breakdown.perfilPts, 0);
  assert.ok(result.score <= 30);
  assert.equal(result.level, PotentialLevel.LOW);
});

test("calculateOpportunityScoreDetails usa o escopo central e exige situação ativa", () => {
  const mercearia = calculateOpportunityScoreDetails({
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4721102",
    nomeFantasia: "Mercearia Teste",
    cidade: "Garça",
  });
  const semSituacao = calculateOpportunityScoreDetails({
    situacaoCadastral: "",
    cnaePrincipal: "4712100",
    nomeFantasia: "Mercado sem situação",
    cidade: "Garça",
  });

  assert.equal(mercearia.breakdown.perfilPts, 30);
  assert.ok(semSituacao.score <= 30);
  assert.equal(semSituacao.level, PotentialLevel.LOW);
});

test("calculateOpportunityScoreDetails reconhece CNAE alvo secundário", () => {
  const result = calculateOpportunityScoreDetails({
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "9999999",
    cnaes: [{ cnaeCode: "4721102" }],
    nomeFantasia: "Mercearia Secundária",
    cidade: "Garça",
  });

  assert.equal(result.breakdown.perfilPts, 30);
  assert.ok(result.score > 30);
});

test("calculateGarcaDistance calcula distancias por coordenadas ou nome de cidade", () => {
  const distGarca = calculateGarcaDistance(-22.2131, -49.6553, "Garça");
  assert.equal(distGarca, 0);

  const distBastos = calculateGarcaDistance(null, null, "Bastos");
  assert.equal(distBastos, 110);
});

test("getPotentialLevel mapeia corretamente os niveis de oportunidade conforme nova faixa", () => {
  assert.equal(getPotentialLevel(85), PotentialLevel.CRITICAL); // 80–100: Crítica
  assert.equal(getPotentialLevel(70), PotentialLevel.HIGH);     // 65–79: Alta
  assert.equal(getPotentialLevel(50), PotentialLevel.MEDIUM);   // 45–64: Média
  assert.equal(getPotentialLevel(30), PotentialLevel.LOW);      // 0–44: Baixa
});
