import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { AuditEvent, AuditLoggerService } from "./audit-logger.service";
import {
  COMMERCIAL_ACTION_MUTATION_KEY,
  DatasetFreezeGuard,
  FROZEN_DATASET_READ_ONLY_KEY,
  MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
} from "./dataset-freeze.guard";

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string) => values[key] as T | undefined,
  } as ConfigService;
}

function createContext(
  method: string,
  options: {
    readOnly?: boolean;
    commercialAction?: boolean;
    manualLocationAdjustment?: boolean;
  } = {},
): ExecutionContext {
  const handler = () => undefined;
  if (options.readOnly) Reflect.defineMetadata(FROZEN_DATASET_READ_ONLY_KEY, true, handler);
  if (options.commercialAction) {
    Reflect.defineMetadata(COMMERCIAL_ACTION_MUTATION_KEY, true, handler);
  }
  if (options.manualLocationAdjustment) {
    Reflect.defineMetadata(MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY, true, handler);
  }
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
  assert.equal(productionGuard.canActivate(createContext("POST", { readOnly: true })), true);
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

test("DatasetFreezeGuard - permite acao comercial sem liberar mutacoes do dataset", () => {
  const events: AuditEvent[] = [];
  const logger = {
    logEvent: (event: AuditEvent) => {
      events.push(event);
    },
  } as unknown as AuditLoggerService;

  const guard = new DatasetFreezeGuard(
    createConfig({ NODE_ENV: "production", ENABLE_LEAD_MUTATIONS: "false" }),
    logger,
    new Reflector(),
  );

  assert.equal(guard.canActivate(createContext("POST", { commercialAction: true })), true);
  assert.equal(events.length, 0);
});

test("DatasetFreezeGuard - flags reais permitem somente ajuste manual marcado", () => {
  const events: AuditEvent[] = [];
  const logger = {
    logEvent: (event: AuditEvent) => {
      events.push(event);
    },
  } as unknown as AuditLoggerService;
  const guard = new DatasetFreezeGuard(
    createConfig({
      NODE_ENV: "production",
      ENABLE_LEAD_MUTATIONS: "false",
      ENABLE_COMMERCIAL_ACTIONS: "true",
    }),
    logger,
    new Reflector(),
  );

  assert.equal(guard.canActivate(createContext("PATCH", { manualLocationAdjustment: true })), true);
  assert.throws(() => guard.canActivate(createContext("POST")), ForbiddenException);
  assert.throws(() => guard.canActivate(createContext("POST")), ForbiddenException);
  assert.equal(events.length, 2);
  assert.equal(events[0]?.action, "DATA_MUTATION_BLOCKED");
});

test("DatasetFreezeGuard - bloqueia acao comercial quando flag especifica esta desligada", () => {
  const events: AuditEvent[] = [];
  const logger = {
    logEvent: (event: AuditEvent) => {
      events.push(event);
    },
  } as unknown as AuditLoggerService;

  const guard = new DatasetFreezeGuard(
    createConfig({
      NODE_ENV: "production",
      ENABLE_LEAD_MUTATIONS: "false",
      ENABLE_COMMERCIAL_ACTIONS: "false",
    }),
    logger,
    new Reflector(),
  );

  assert.throws(
    () => guard.canActivate(createContext("POST", { commercialAction: true })),
    ForbiddenException,
  );
  assert.equal(events[0]?.action, "COMMERCIAL_ACTION_MUTATION_BLOCKED");
  assert.equal(events[0]?.statusCode, 403);
});
