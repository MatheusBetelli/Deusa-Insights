import assert from "node:assert/strict";
import test from "node:test";
import { CallHandler, ExecutionContext } from "@nestjs/common";
import { lastValueFrom, of } from "rxjs";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditEvent, AuditLoggerService } from "./audit-logger.service";

function createContext(request: Record<string, unknown>, statusCode = 200): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({ statusCode }),
    }),
  } as ExecutionContext;
}

test("AuditInterceptor - registra login e exportacao sem expor credenciais", async () => {
  const events: AuditEvent[] = [];
  const logger = {
    logEvent: (event: AuditEvent) => {
      events.push(event);
    },
  } as unknown as AuditLoggerService;
  const interceptor = new AuditInterceptor(logger);

  const loginHandler = {
    handle: () => of({
      accessToken: "token-nao-deve-ser-auditado",
      user: { id: "usr-1", email: "sales@deusa.test" },
    }),
  } as CallHandler;
  await lastValueFrom(interceptor.intercept(createContext({
    method: "POST",
    originalUrl: "/auth/login",
    body: { email: "sales@deusa.test", password: "segredo" },
  }, 201), loginHandler));

  const logoutHandler = { handle: () => of({ message: "ok" }) } as CallHandler;
  await lastValueFrom(interceptor.intercept(createContext({
    method: "POST",
    originalUrl: "/auth/logout",
    user: { sub: "usr-1", email: "sales@deusa.test" },
  }), logoutHandler));

  const exportHandler = { handle: () => of("csv") } as CallHandler;
  await lastValueFrom(interceptor.intercept(createContext({
    method: "GET",
    originalUrl: "/leads/export.csv?city=Franca",
    user: { sub: "usr-1", email: "sales@deusa.test" },
  }), exportHandler));

  assert.deepEqual(events.map((event) => event.action), ["LOGIN", "LOGOUT", "EXPORT_DATA"]);
  assert.equal(events[0]?.userId, "usr-1");
  assert.equal(events[2]?.route, "/leads/export.csv");
  assert.ok(!JSON.stringify(events).includes("segredo"));
  assert.ok(!JSON.stringify(events).includes("token-nao-deve-ser-auditado"));
});
