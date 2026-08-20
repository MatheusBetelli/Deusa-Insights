import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

test("health retorna falha HTTP quando o banco está indisponível", async () => {
  const controller = new HealthController({
    $queryRaw: async () => {
      throw new Error("connection string omitted");
    },
  } as never);

  await assert.rejects(() => controller.checkHealth(), ServiceUnavailableException);
});
