import assert from "node:assert/strict";
import test from "node:test";
import { createRequestIdMiddleware, RequestWithId } from "./request-id.middleware";

function execute(candidate?: string) {
  const request = {
    get: (name: string) => (name.toLowerCase() === "x-request-id" ? candidate : undefined),
  } as RequestWithId;
  let responseId: string | undefined;
  let nextCalled = false;
  const response = {
    setHeader: (_name: string, value: string) => {
      responseId = value;
    },
  };

  createRequestIdMiddleware()(request, response as never, () => {
    nextCalled = true;
  });
  return { nextCalled, requestId: request.requestId, responseId };
}

test("request id válido é preservado e devolvido ao cliente", () => {
  const result = execute("trace-empresa-2026");
  assert.equal(result.nextCalled, true);
  assert.equal(result.requestId, "trace-empresa-2026");
  assert.equal(result.responseId, result.requestId);
});

test("request id hostil é substituído por UUID gerado pelo servidor", () => {
  const result = execute("<script>alert(1)</script>");
  assert.match(result.requestId ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(result.responseId, result.requestId);
});
