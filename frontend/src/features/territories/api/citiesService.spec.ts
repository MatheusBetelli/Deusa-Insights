import assert from "node:assert/strict";
import test from "node:test";
import { citiesService } from "@/features/territories/api/citiesService";

test("citiesService - declara método getCities", () => {
  assert.equal(typeof citiesService.getCities, "function");
});
