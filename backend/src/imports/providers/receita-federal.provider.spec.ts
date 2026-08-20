import test from "node:test";
import assert from "node:assert/strict";
import { parseSemicolonCsvLine } from "./receita-federal.provider";

test("parseSemicolonCsvLine preserva separadores e aspas dentro de campos", () => {
  assert.deepEqual(parseSemicolonCsvLine('"123";"Mercado; Central";"Rua ""A"""'), [
    "123",
    "Mercado; Central",
    'Rua "A"',
  ]);
});
