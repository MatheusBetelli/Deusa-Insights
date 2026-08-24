import assert from "node:assert/strict";
import test from "node:test";
import { NextFunction, Request, Response } from "express";
import { createOriginProtectionMiddleware } from "./origin-protection.middleware";

function execute(method: string, origin: string | undefined, isProduction = true) {
  let nextCalled = false;
  let statusCode: number | undefined;
  let payload: unknown;
  const request = {
    method,
    get: (name: string) => (name.toLowerCase() === "origin" ? origin : undefined),
  } as Request;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      payload = body;
      return this;
    },
  } as Response;
  const next = (() => {
    nextCalled = true;
  }) as NextFunction;

  createOriginProtectionMiddleware(
    isProduction,
    new Set(["https://app.example.test"]),
  )(request, response, next);

  return { nextCalled, statusCode, payload };
}

test("origin protection permite leitura e origem de producao autorizada", () => {
  assert.equal(execute("GET", undefined).nextCalled, true);
  assert.equal(execute("POST", "https://app.example.test").nextCalled, true);
});

test("origin protection bloqueia mutacao sem origem ou com origem hostil", () => {
  assert.equal(execute("POST", undefined).statusCode, 403);
  assert.equal(execute("PATCH", "https://attacker.example").statusCode, 403);
});

test("origin protection nao interfere no ambiente de desenvolvimento", () => {
  assert.equal(execute("DELETE", undefined, false).nextCalled, true);
});
