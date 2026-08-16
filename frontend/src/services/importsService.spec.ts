import test from "node:test";
import assert from "node:assert/strict";
import { importsService } from "./importsService";

test("importsService - declara métodos de importação de CNPJs e planilhas", () => {
  assert.equal(typeof importsService.importCnpjs, "function");
  assert.equal(typeof importsService.getImports, "function");
  assert.equal(typeof importsService.getImport, "function");
  assert.equal(typeof importsService.uploadExcelClients, "function");
});
