import path from "node:path";
import { openDatabase, resetImportedTables } from "./db.js";
import { readRowsFromFile } from "./file-reader.js";
import { mapCustomer, mapExternal, mapSale } from "./mapper.js";
import { PROCESSED_DIR, inferFileKind, listImportFiles, writeJson } from "./utils.js";

function insertRegion(db, cidade, regiao) {
  if (!cidade) return;
  db.prepare(
    "INSERT OR IGNORE INTO regions (cidade, uf, regiao) VALUES (?, 'SP', ?)",
  ).run(cidade, regiao || "");
}

function insertCustomer(db, item) {
  db.prepare(`
    INSERT INTO current_customers (
      cnpj, normalized_cnpj, razao_social, nome_estabelecimento, normalized_name,
      cidade, normalized_city, regiao, status_cliente, produtos_comprados,
      source_file, validation_status, validation_errors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.cnpj,
    item.normalized_cnpj,
    item.razao_social,
    item.nome_estabelecimento,
    item.normalized_name,
    item.cidade,
    item.normalized_city,
    item.regiao,
    item.status_cliente,
    item.produtos_comprados,
    item.source_file,
    item.validation_status,
    item.validation_errors,
  );
  insertRegion(db, item.cidade, item.regiao);
}

function insertExternal(db, item) {
  db.prepare(`
    INSERT INTO external_establishments (
      cnpj, normalized_cnpj, nome_estabelecimento, normalized_name,
      cidade, normalized_city, regiao, segmento_cnae, endereco, telefone,
      source_file, validation_status, validation_errors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.cnpj,
    item.normalized_cnpj,
    item.nome_estabelecimento,
    item.normalized_name,
    item.cidade,
    item.normalized_city,
    item.regiao,
    item.segmento_cnae,
    item.endereco,
    item.telefone,
    item.source_file,
    item.validation_status,
    item.validation_errors,
  );
  insertRegion(db, item.cidade, item.regiao);
}

function insertSale(db, item) {
  db.prepare(`
    INSERT INTO sales (
      customer_cnpj, normalized_cnpj, nome_estabelecimento, normalized_name,
      cidade, normalized_city, produto, valor, data_venda,
      source_file, validation_status, validation_errors
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    item.customer_cnpj,
    item.normalized_cnpj,
    item.nome_estabelecimento,
    item.normalized_name,
    item.cidade,
    item.normalized_city,
    item.produto,
    item.valor,
    item.data_venda,
    item.source_file,
    item.validation_status,
    item.validation_errors,
  );
}

function importRows(db, kind, rows, sourceFile) {
  const counters = { imported: 0, invalid: 0 };

  rows.forEach((row) => {
    const mapped =
      kind === "customers"
        ? mapCustomer(row, sourceFile)
        : kind === "external"
          ? mapExternal(row, sourceFile)
          : mapSale(row, sourceFile);

    if (kind === "customers") insertCustomer(db, mapped);
    if (kind === "external") insertExternal(db, mapped);
    if (kind === "sales") insertSale(db, mapped);

    if (mapped.validation_status === "VALID") counters.imported += 1;
    else counters.invalid += 1;
  });

  return counters;
}

export function importData() {
  const db = openDatabase();
  resetImportedTables(db);

  const files = listImportFiles();
  const report = {
    generatedAt: new Date().toISOString(),
    database: "data/deusa_analytics.db",
    usedMockData: false,
    files: [],
    totals: { imported: 0, invalid: 0, failedFiles: 0 },
  };

  if (files.length === 0) {
    console.log("Nenhum arquivo encontrado para importação em data/imports.");
  } else {
    files.forEach((filePath) => {
      const sourceFile = path.basename(filePath);
      const kind = inferFileKind(filePath);

      if (kind === "unknown") {
        report.files.push({
          file: sourceFile,
          kind,
          imported: 0,
          invalid: 0,
          error: "Nome do arquivo nao indica tipo. Use clientes*, externos*/estabelecimentos* ou vendas*.",
        });
        report.totals.failedFiles += 1;
        return;
      }

      try {
        const rows = readRowsFromFile(filePath);
        const counters = importRows(db, kind, rows, sourceFile);
        report.files.push({ file: sourceFile, kind, rows: rows.length, ...counters });
        report.totals.imported += counters.imported;
        report.totals.invalid += counters.invalid;
      } catch (error) {
        report.files.push({
          file: sourceFile,
          kind,
          imported: 0,
          invalid: 0,
          error: error instanceof Error ? error.message : String(error),
        });
        report.totals.failedFiles += 1;
      }
    });
  }

  writeJson(path.join(PROCESSED_DIR, "import-report.json"), report);
  db.close();
  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = importData();
  console.log(JSON.stringify(report, null, 2));
}
