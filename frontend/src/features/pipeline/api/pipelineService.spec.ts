import assert from "node:assert/strict";
import test from "node:test";
import { pipelineService } from "@/features/pipeline/api/pipelineService";

test("pipelineService - declara métodos getPipeline e getStage", () => {
  assert.equal(typeof pipelineService.getPipeline, "function");
  assert.equal(typeof pipelineService.getStage, "function");
});
