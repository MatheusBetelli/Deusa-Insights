import test from "node:test";
import assert from "node:assert/strict";
import { AuditLoggerService } from "./audit-logger.service";

test("AuditLoggerService - grava evento de auditoria com e-mail mascarado", () => {
  const service = new AuditLoggerService();
  let loggedMsg = "";

  (service as any).logger = {
    log: (msg: string) => {
      loggedMsg = msg;
    },
  };

  service.logEvent({
    userId: "usr_123",
    userEmail: "usuario.teste@inovaskill.com",
    action: "LOGIN",
    details: "Sucesso",
    ip: "127.0.0.1",
  });

  assert.ok(loggedMsg.includes("[AUDIT LGPD]"));
  assert.ok(loggedMsg.includes("User: usr_123"));
  assert.ok(loggedMsg.includes("u***e@inovaskill.com") || loggedMsg.includes("***"));
  assert.ok(loggedMsg.includes("Ação: LOGIN"));
});
