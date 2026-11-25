import assert from "node:assert/strict";
import test from "node:test";
import { filterSegments, sumSegments, toNumber, buildYearOptions } from "./dashboard-model";

test("dashboard segment selection preserves totals and supports clearing filters", () => {
  const segments = [
    { key: "active", name: "Ativos", count: 30, percentage: 75 },
    { key: "inactive", name: "Inativos", count: 10, percentage: 25 },
  ];
  assert.equal(sumSegments(filterSegments(segments, [])), 40);
  assert.equal(sumSegments(filterSegments(segments, ["active"])), 30);
  assert.equal(sumSegments(filterSegments(segments, ["missing"])), 0);
  assert.equal(sumSegments(segments), 40);
});

test("dashboard normalizes missing numeric chart values and builds year options", () => {
  assert.equal(toNumber(undefined), 0);
  assert.equal(toNumber("invalid"), 0);
  assert.equal(toNumber("12.5"), 12.5);
  assert.deepEqual(buildYearOptions(2026), [2026, 2025, 2024, 2023, 2022, 2021]);
});
