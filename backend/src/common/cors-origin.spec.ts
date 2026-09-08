import assert from "node:assert/strict";
import test from "node:test";
import { createCorsOriginValidator, createCorsPreflightGuard } from "./cors-origin";

function execute(isProduction: boolean, origin: string | undefined) {
  let error: Error | null | undefined;
  let allowed: boolean | undefined;
  createCorsOriginValidator(isProduction, new Set(["https://app.example.test"]))(
    origin,
    (callbackError, callbackAllowed) => {
      error = callbackError;
      allowed = callbackAllowed;
    },
  );
  return { error, allowed };
}

test("CORS permite origem explicitamente autorizada", () => {
  assert.deepEqual(execute(true, "https://app.example.test"), { error: null, allowed: true });
});

test("CORS rejeita origem hostil sem transformar bloqueio esperado em erro", () => {
  assert.deepEqual(execute(true, "https://attacker.example"), { error: null, allowed: false });
});

test("CORS não permite chamada sem Origin como navegador em produção", () => {
  assert.deepEqual(execute(true, undefined), { error: null, allowed: false });
});

test("CORS permite localhost somente fora de produção", () => {
  assert.deepEqual(execute(false, "http://localhost:5173"), { error: null, allowed: true });
  assert.deepEqual(execute(true, "http://localhost:5173"), { error: null, allowed: false });
});

test("preflight hostil retorna 403 controlado em produção", () => {
  let nextCalled = false;
  let statusCode: number | undefined;
  let body: unknown;
  const guard = createCorsPreflightGuard(true, new Set(["https://app.example.test"]));

  guard(
    { method: "OPTIONS", get: () => "https://attacker.example" } as never,
    {
      status: (status: number) => {
        statusCode = status;
        return { json: (value: unknown) => (body = value) } as never;
      },
    } as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
  assert.deepEqual(body, {
    statusCode: 403,
    error: "Forbidden",
    message: "Origem da requisicao nao autorizada",
  });
});

test("preflight autorizado continua para o middleware CORS", () => {
  let nextCalled = false;
  const guard = createCorsPreflightGuard(true, new Set(["https://app.example.test"]));

  guard({ method: "OPTIONS", get: () => "https://app.example.test" } as never, {} as never, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
});

test("preflight sem Origin é rejeitado em produção", () => {
  let nextCalled = false;
  let statusCode: number | undefined;
  const guard = createCorsPreflightGuard(true, new Set(["https://app.example.test"]));

  guard(
    { method: "OPTIONS", get: () => undefined } as never,
    {
      status: (status: number) => {
        statusCode = status;
        return { json: () => undefined } as never;
      },
    } as never,
    () => {
      nextCalled = true;
    },
  );

  assert.equal(nextCalled, false);
  assert.equal(statusCode, 403);
});
