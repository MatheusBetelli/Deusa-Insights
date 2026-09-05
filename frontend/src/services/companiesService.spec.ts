import test from "node:test";
import assert from "node:assert/strict";
import { companiesService } from "./companiesService";

test("companiesService - declara todos os métodos de empresas B2B", () => {
  assert.equal(typeof companiesService.getCompanies, "function");
  assert.equal(typeof companiesService.getCompaniesPage, "function");
  assert.equal(typeof companiesService.getCompany, "function");
  assert.equal(typeof companiesService.syncByCnpj, "function");
  assert.equal(typeof companiesService.getCompanyDetails, "function");
  assert.equal(typeof companiesService.upsertCompanyDetails, "function");
  assert.equal(typeof companiesService.updateCompany, "function");
  assert.equal(typeof companiesService.updateLocation, "function");
});
