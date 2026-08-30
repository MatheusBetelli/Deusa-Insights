import assert from "node:assert/strict";
import test from "node:test";
import { mapService } from "./mapService";

test("mapService - declara método getOpportunities", () => {
  assert.equal(typeof mapService.getOpportunities, "function");
});
