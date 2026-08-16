import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidOpportunityCnae,
  isRuralOrNonCommercialLocation,
  isWithinUrbanTerritory,
  isValidOpportunity,
} from "./opportunity-filter";

test("isValidOpportunityCnae aceita os 4 CNAEs alvo permitidos", () => {
  assert.equal(isValidOpportunityCnae("4712100"), true); // Minimercado / Mercado
  assert.equal(isValidOpportunityCnae("47.12-1/00"), true);
  assert.equal(isValidOpportunityCnae("4711302"), true); // Supermercado
  assert.equal(isValidOpportunityCnae("4711-3/02"), true);
  assert.equal(isValidOpportunityCnae("4711301"), true); // Hipermercado
  assert.equal(isValidOpportunityCnae("4711-3/01"), true);
  assert.equal(isValidOpportunityCnae("4722901"), true); // Açougue
  assert.equal(isValidOpportunityCnae("4722-9/01"), true);
});

test("isValidOpportunityCnae rejeita CNAEs fora das 4 categorias autorizadas", () => {
  assert.equal(isValidOpportunityCnae("4729699"), false); // Comércio alimentício geral
  assert.equal(isValidOpportunityCnae("4639701"), false); // Atacadista
  assert.equal(isValidOpportunityCnae("4721102"), false); // Padaria
  assert.equal(isValidOpportunityCnae("4724500"), false); // Hortifruti
  assert.equal(isValidOpportunityCnae("4520000"), false); // Oficina mecânica
  assert.equal(isValidOpportunityCnae(null), false);
  assert.equal(isValidOpportunityCnae(""), false);
});

test("isRuralOrNonCommercialLocation detecta propriedades rurais pelo nome ou endereço", () => {
  assert.equal(
    isRuralOrNonCommercialLocation({
      nomeFantasia: "Fazenda Nossa Senhora da Conceição",
    }),
    true,
  );

  assert.equal(
    isRuralOrNonCommercialLocation({
      razaoSocial: "Estância Betel Ovos",
    }),
    true,
  );

  assert.equal(
    isRuralOrNonCommercialLocation({
      nomeFantasia: "Sítio Furio Hortifruti",
    }),
    true,
  );

  assert.equal(
    isRuralOrNonCommercialLocation({
      logradouro: "Estrada Rural Bairro Alto",
    }),
    true,
  );

  assert.equal(
    isRuralOrNonCommercialLocation({
      bairro: "Chácara São João",
    }),
    true,
  );
});

test("isRuralOrNonCommercialLocation aprova estabelecimentos comerciais urbanos", () => {
  assert.equal(
    isRuralOrNonCommercialLocation({
      nomeFantasia: "Supermercado Minakawa",
      logradouro: "Rua São Paulo",
      bairro: "Centro",
    }),
    false,
  );

  assert.equal(
    isRuralOrNonCommercialLocation({
      nomeFantasia: "Casa de Carnes Central",
      logradouro: "Avenida Brasil",
      bairro: "Vila Real",
    }),
    false,
  );
});

test("isWithinUrbanTerritory aprova coordenadas próximas ao centroide da cidade", () => {
  // Centroide Marília: -22.2139, -49.9467
  const isUrban = isWithinUrbanTerritory("Marília", -22.215, -49.948, "SP");
  assert.equal(isUrban, true);
});

test("isWithinUrbanTerritory rejeita coordenadas distantes fora do raio urbano", () => {
  // Centroide Garça: -22.2131, -49.6553
  // Ponto muito afastado (-21.0, -48.0)
  const isUrban = isWithinUrbanTerritory("Garça", -21.0, -48.0, "SP");
  assert.equal(isUrban, false);
});

test("isValidOpportunity aprova apenas oportunidades que atendam simultaneamente à categoria e à localização urbana", () => {
  const validMarket = {
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4711302",
    cidade: "Marília",
    uf: "SP",
    latitude: -22.215,
    longitude: -49.948,
    nomeFantasia: "Supermercado Central",
    logradouro: "Rua das Flores",
    bairro: "Centro",
  };
  assert.equal(isValidOpportunity(validMarket), true);

  const ruralFarm = {
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4712100", // CNAE de minimercado
    cidade: "Vera Cruz",
    uf: "SP",
    nomeFantasia: "Fazenda Nossa Senhora da Conceição", // Nome rural!
  };
  assert.equal(isValidOpportunity(ruralFarm), false);

  const invalidCategory = {
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4520000", // Categoria não alimentícia (Manutenção de veículos)
    cidade: "Garça",
    uf: "SP",
    nomeFantasia: "Auto Peças Geral",
  };
  assert.equal(isValidOpportunity(invalidCategory), false);

  const healthFoodStore = {
    situacaoCadastral: "ATIVA",
    cnaePrincipal: "4712100",
    cidade: "Bastos",
    uf: "SP",
    nomeFantasia: "Mercadinho Novo Bastos - Produtos Naturais e Suplementos",
  };
  assert.equal(isValidOpportunity(healthFoodStore), false);
});

