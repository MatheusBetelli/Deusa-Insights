import test from "node:test";
import assert from "node:assert/strict";
import { calculateLeadScore, getPotentialLevel } from "./scoring";
import { PotentialLevel } from "@prisma/client";

test("calculateLeadScore calcula score correto para empresa com todos os requisitos", () => {
  const score = calculateLeadScore({
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4712100",
    targetCnaes: ["4712100", "4711302"],
    nomeFantasia: "Mercado Bom Preço",
    porte: "ME",
    cidade: "Tupã",
    priorityCities: ["TUPÃ", "MARÍLIA"],
    latitude: -21.93,
    longitude: -50.51,
  });

  // 30 (ativa) + 25 (target cnae) + 15 (nome fantasia) + 10 (porte ME) + 10 (cidade prioritaria) + 10 (coordenadas) = 100
  assert.equal(score, 100);
});

test("calculateLeadScore retorna score 0 para empresa sem atributos", () => {
  const score = calculateLeadScore({});
  assert.equal(score, 0);
});

test("getPotentialLevel mapeia corretamente os niveis de oportunidade", () => {
  assert.equal(getPotentialLevel(95), PotentialLevel.CRITICAL);
  assert.equal(getPotentialLevel(80), PotentialLevel.HIGH);
  assert.equal(getPotentialLevel(60), PotentialLevel.MEDIUM);
  assert.equal(getPotentialLevel(30), PotentialLevel.LOW);
});
