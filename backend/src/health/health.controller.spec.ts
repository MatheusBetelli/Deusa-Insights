import test from "node:test";
import assert from "node:assert/strict";
import { ServiceUnavailableException } from "@nestjs/common";
import { HealthController } from "./health.controller";

test("liveness não depende do banco de dados", () => {
  const controller = new HealthController({} as never);
  const result = controller.checkLiveness();

  assert.equal(result.status, "ok");
  assert.equal(result.service, "available");
});

test("readiness confirma conexão com o banco", async () => {
  const controller = new HealthController({
    $queryRaw: async () => [{ connected: 1 }],
  } as never);

  const result = await controller.checkReadiness();
  assert.equal(result.status, "ok");
  assert.equal(result.database, "connected");
});

test("health retorna falha HTTP quando o banco está indisponível", async () => {
  const controller = new HealthController({
    $queryRaw: async () => {
      throw new Error("connection string omitted");
    },
  } as never);

  await assert.rejects(() => controller.checkHealth(), ServiceUnavailableException);
});
