import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { AuditEvent, AuditLoggerService } from "./audit-logger.service";
import {
  DatasetFreezeGuard,
  FROZEN_DATASET_READ_ONLY_KEY,
} from "./dataset-freeze.guard";

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string) => values[key] as T | undefined,
  } as ConfigService;
}

function createContext(method: string, readOnly = false): ExecutionContext {
  const handler = () => undefined;
  if (readOnly) Reflect.defineMetadata(FROZEN_DATASET_READ_ONLY_KEY, true, handler);
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        method,
        originalUrl: "/leads/lead-1",
        ip: "203.0.113.10",
        user: { sub: "usr-1", email: "sales@deusa.test" },
      }),
    }),
  } as unknown as ExecutionContext;
}

test("DatasetFreezeGuard - bloqueia mutacoes por padrao em producao", () => {
  const events: AuditEvent[] = [];
  const logger = {
    logEvent: (event: AuditEvent) => {
      events.push(event);
    },
  } as unknown as AuditLoggerService;

  const reflector = new Reflector();
  const productionGuard = new DatasetFreezeGuard(
    createConfig({ NODE_ENV: "production" }),
    logger,
    reflector,
  );
  assert.throws(() => productionGuard.canActivate(createContext("PATCH")), ForbiddenException);
  assert.equal(productionGuard.canActivate(createContext("GET")), true);
  assert.equal(productionGuard.canActivate(createContext("POST", true)), true);
  assert.equal(events[0]?.action, "DATA_MUTATION_BLOCKED");
  assert.equal(events[0]?.statusCode, 403);

  const enabledGuard = new DatasetFreezeGuard(
    createConfig({ NODE_ENV: "production", ENABLE_LEAD_MUTATIONS: "true" }),
    logger,
    reflector,
  );
  assert.equal(enabledGuard.canActivate(createContext("POST")), true);

  const developmentGuard = new DatasetFreezeGuard(
    createConfig({ NODE_ENV: "development" }),
    logger,
    reflector,
  );
  assert.equal(developmentGuard.canActivate(createContext("DELETE")), true);
});
