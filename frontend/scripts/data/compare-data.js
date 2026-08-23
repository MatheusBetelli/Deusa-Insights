import path from "node:path";
import { openDatabase, resetComparisonTables } from "./db.js";
import { PROCESSED_DIR, SUMMARY_PATH, normalizeText, writeJson } from "./utils.js";

const INACTIVE_STATUS = new Set(["INATIVO", "INATIVA", "CLIENTE_INATIVO", "SEM COMPRA", "DORMANT"]);

function customerIsInactive(customer) {
  return INACTIVE_STATUS.has(normalizeText(customer.status_cliente).toUpperCase());
}

function classifyExternal(external, customerByCnpj, customersByNameCity) {
  if (external.validation_status !== "VALID") {
    return {
      currentCustomer: null,
      classification: "DADO_INCOMPLETO",
      matchStrategy: "VALIDATION",
      confidence: 0,
      reason: external.validation_errors || "Registro externo com dados incompletos.",
    };
  }

  if (external.normalized_cnpj) {
    const currentCustomer = customerByCnpj.get(external.normalized_cnpj);
    if (currentCustomer) {
      const inactive = customerIsInactive(currentCustomer);
      return {
        currentCustomer,
        classification: inactive ? "CLIENTE_INATIVO" : "CLIENTE_ATUAL",
        matchStrategy: "CNPJ",
        confidence: 1,
        reason: inactive
          ? "CNPJ encontrado na base interna com status inativo."
          : "CNPJ encontrado na base interna ativa.",
      };
    }
  }

  const fallbackKey = `${external.normalized_name}|${external.normalized_city}`;
  const fallbackCustomer = customersByNameCity.get(fallbackKey);
  if (fallbackCustomer) {
    const inactive = customerIsInactive(fallbackCustomer);
    return {
      currentCustomer: fallbackCustomer,
      classification: inactive ? "CLIENTE_INATIVO" : "CLIENTE_ATUAL",
      matchStrategy: "NOME_CIDADE",
      confidence: 0.82,
      reason: inactive
        ? "Correspondencia por nome e cidade com cliente interno inativo."
        : "Correspondencia por nome e cidade com cliente interno ativo.",
    };
  }

  return {
    currentCustomer: null,
    classification: "POTENCIAL_CLIENTE",
    matchStrategy: external.normalized_cnpj ? "CNPJ_SEM_MATCH" : "NOME_CIDADE_SEM_MATCH",
    confidence: external.normalized_cnpj ? 0.72 : 0.55,
    reason: external.normalized_cnpj
      ? "CNPJ externo nao encontrado na base interna."
      : "Sem CNPJ e sem correspondencia por nome/cidade.",
  };
}

function createSummary(db) {
  const classificationRows = db
    .prepare(
      `
    SELECT classification, COUNT(*) AS total
    FROM comparison_results
    GROUP BY classification
  `,
    )
    .all();

  const classifications = Object.fromEntries(
    classificationRows.map((row) => [row.classification, row.total]),
  );
  const regionRows = db
    .prepare(
      `
    SELECT
      COALESCE(NULLIF(regiao, ''), cidade, 'Sem regiao') AS regiao,
      COUNT(*) AS opportunities
    FROM comparison_results
    WHERE classification IN ('POTENCIAL_CLIENTE', 'CLIENTE_INATIVO')
    GROUP BY COALESCE(NULLIF(regiao, ''), cidade, 'Sem regiao')
    ORDER BY opportunities DESC
    LIMIT 8
  `,
    )
    .all();

  const cityRows = db
    .prepare(
      `
    SELECT
      cidade,
      COUNT(*) AS opportunities
    FROM comparison_results
    WHERE classification IN ('POTENCIAL_CLIENTE', 'CLIENTE_INATIVO')
    GROUP BY cidade
    ORDER BY opportunities DESC
    LIMIT 8
  `,
    )
    .all();

  const unmatched = db
    .prepare(
      `
    SELECT nome_estabelecimento, cnpj, cidade, regiao, classification, reason
    FROM comparison_results
    WHERE classification IN ('POTENCIAL_CLIENTE', 'DADO_INCOMPLETO')
    ORDER BY classification DESC, cidade ASC
    LIMIT 12
  `,
    )
    .all();

  return {
    generatedAt: new Date().toISOString(),
    source: "sqlite",
    totals: {
      clientesEncontrados: classifications.CLIENTE_ATUAL ?? 0,
      potenciaisClientes: classifications.POTENCIAL_CLIENTE ?? 0,
      clientesInativos: classifications.CLIENTE_INATIVO ?? 0,
      dadosIncompletos: classifications.DADO_INCOMPLETO ?? 0,
      estabelecimentosSemCorrespondencia:
        (classifications.POTENCIAL_CLIENTE ?? 0) + (classifications.DADO_INCOMPLETO ?? 0),
      regioesComOportunidade: regionRows.length,
    },
    regioesComOportunidade: regionRows,
    cidadesComOportunidade: cityRows,
    estabelecimentosSemCorrespondencia: unmatched,
  };
}

export function compareData() {
  const db = openDatabase();
  resetComparisonTables(db);

  const customers = db
    .prepare("SELECT * FROM current_customers WHERE validation_status = 'VALID'")
    .all();
  const externalItems = db.prepare("SELECT * FROM external_establishments").all();

  const customerByCnpj = new Map(
    customers.filter((item) => item.normalized_cnpj).map((item) => [item.normalized_cnpj, item]),
  );
  const customersByNameCity = new Map(
    customers
      .filter((item) => item.normalized_name && item.normalized_city)
      .map((item) => [`${item.normalized_name}|${item.normalized_city}`, item]),
  );

  const insertComparison = db.prepare(`
    INSERT INTO comparison_results (
      external_establishment_id, current_customer_id, cnpj, nome_estabelecimento,
      cidade, regiao, classification, match_strategy, confidence, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOpportunity = db.prepare(`
    INSERT INTO commercial_opportunities (
      external_establishment_id, cnpj, nome_estabelecimento, cidade, regiao,
      segmento_cnae, classification, match_strategy, confidence, reason
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  externalItems.forEach((external) => {
    const result = classifyExternal(external, customerByCnpj, customersByNameCity);
    insertComparison.run(
      external.id,
      result.currentCustomer?.id ?? null,
      external.cnpj,
      external.nome_estabelecimento,
      external.cidade,
      external.regiao,
      result.classification,
      result.matchStrategy,
      result.confidence,
      result.reason,
    );

    if (
      ["POTENCIAL_CLIENTE", "CLIENTE_INATIVO", "DADO_INCOMPLETO"].includes(result.classification)
    ) {
      insertOpportunity.run(
        external.id,
        external.cnpj,
        external.nome_estabelecimento,
        external.cidade,
        external.regiao,
        external.segmento_cnae,
        result.classification,
        result.matchStrategy,
        result.confidence,
        result.reason,
      );
    }
  });

  const summary = createSummary(db);
  const report = {
    generatedAt: new Date().toISOString(),
    comparedExternalRecords: externalItems.length,
    comparedCustomers: customers.length,
    summary,
  };

  writeJson(path.join(PROCESSED_DIR, "comparison-report.json"), report);
  writeJson(SUMMARY_PATH, summary);
  db.close();
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = compareData();
  console.log(JSON.stringify(report, null, 2));
}
