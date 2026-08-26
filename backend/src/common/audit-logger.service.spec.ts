import test from "node:test";
import assert from "node:assert/strict";
import { AuditLoggerService } from "./audit-logger.service";

test("AuditLoggerService - grava evento de auditoria com e-mail mascarado", () => {
  const service = new AuditLoggerService();
  let loggedMsg = "";

  Object.defineProperty(service, "logger", {
    value: {
      log: (msg: string) => {
        loggedMsg = msg;
      },
    },
  });

  service.logEvent({
    userId: "usr_123",
    userEmail: "usuario.teste@inovaskill.com",
    action: "LOGIN",
    details: "Sucesso",
    ip: "127.0.0.1",
    requestId: "request-123",
  });

  const event = JSON.parse(loggedMsg) as {
    event: string;
    action: string;
    actor: { id: string; email: string };
    requestId: string;
  };
  assert.equal(event.event, "security.audit");
  assert.equal(event.action, "LOGIN");
  assert.equal(event.actor.id, "usr_123");
  assert.equal(event.actor.email, "u***e@inovaskill.com");
  assert.equal(event.requestId, "request-123");
  assert.ok(!loggedMsg.includes("usuario.teste@inovaskill.com"));
});
