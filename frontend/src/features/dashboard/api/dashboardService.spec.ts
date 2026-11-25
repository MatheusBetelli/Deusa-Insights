import assert from "node:assert/strict";
import test from "node:test";
import { dashboardService } from "@/features/dashboard/api/dashboardService";

test("dashboardService - declara método getSummary", () => {
  assert.equal(typeof dashboardService.getSummary, "function");
});
