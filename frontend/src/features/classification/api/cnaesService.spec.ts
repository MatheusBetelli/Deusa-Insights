import test from "node:test";
import assert from "node:assert/strict";
import { cnaesService } from "@/features/classification/api/cnaesService";

test("cnaesService - declara métodos de busca de CNAEs", () => {
  assert.equal(typeof cnaesService.getCnaes, "function");
  assert.equal(typeof cnaesService.getCnaesPage, "function");
});
