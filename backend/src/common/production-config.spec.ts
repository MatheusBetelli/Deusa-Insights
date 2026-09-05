import assert from "node:assert/strict";
import test from "node:test";
import { ProductionConfig, validateProductionConfig } from "./production-config";

const validConfig: ProductionConfig = {
  databaseUrl: "postgresql://runtime:secret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres",
  jwtSecret: "a".repeat(48),
  frontendUrl: "https://app.example.com",
  allowedOrigins: "https://app.example.com",
  authCookieSameSite: "lax",
  resendApiKey: "re_test_key",
  resendFromEmail: "Deusa <no-reply@example.com>",
  enableLeadMutations: "false",
  enableCommercialActions: "true",
};

test("configuração de produção válida não gera erros", () => {
  assert.deepEqual(validateProductionConfig(validConfig), []);
});

test("configuração de produção rejeita DIRECT_URL e mutações do dataset", () => {
  const errors = validateProductionConfig({
    ...validConfig,
    directUrl: "postgresql://admin@db.example.com:5432/postgres",
    enableLeadMutations: "true",
    enableCommercialActions: "false",
  });

  assert.equal(
    errors.some((error) => error.includes("DIRECT_URL")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("ENABLE_LEAD_MUTATIONS")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("ENABLE_COMMERCIAL_ACTIONS")),
    true,
  );
});

test("configuração de produção rejeita banco local e origens inseguras", () => {
  const errors = validateProductionConfig({
    ...validConfig,
    databaseUrl: "postgresql://postgres:postgres@127.0.0.1:5432/deusa",
    frontendUrl: "http://localhost:5173",
    allowedOrigins: "https://app.example.com,http://localhost:5173",
  });

  assert.equal(
    errors.some((error) => error.includes("localhost")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("ALLOWED_ORIGINS")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("FRONTEND_URL")),
    true,
  );
});

test("configuração de produção rejeita host de banco placeholder", () => {
  const errors = validateProductionConfig({
    ...validConfig,
    databaseUrl: "postgresql://runtime:secret@host:5432/postgres",
  });

  assert.equal(
    errors.some((error) => error.includes("placeholder")),
    true,
  );
});

test("configuração de produção rejeita segredo fraco e credenciais ausentes", () => {
  const errors = validateProductionConfig({
    ...validConfig,
    jwtSecret: "dev-secret-change-me-aaaaaaaaaaaaaaaaaaaaaaaa",
    resendApiKey: "",
    resendFromEmail: "",
  });

  assert.equal(
    errors.some((error) => error.includes("JWT_SECRET")),
    true,
  );
  assert.equal(
    errors.some((error) => error.includes("RESEND")),
    true,
  );
});
