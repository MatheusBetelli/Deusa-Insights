import assert from "node:assert";
import { test } from "node:test";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3001";
const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:8080";
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;
const missingCredentialsReason =
  E2E_EMAIL && E2E_PASSWORD ? false : "Defina E2E_EMAIL e E2E_PASSWORD para executar testes autenticados";

let cachedAdminToken: string | null = null;

async function getAdminToken() {
  if (cachedAdminToken) return cachedAdminToken;
  assert.ok(E2E_EMAIL && E2E_PASSWORD, "Credenciais E2E não configuradas");
  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  });
  assert.strictEqual(loginRes.status, 201);
  const { accessToken } = await loginRes.json();
  cachedAdminToken = accessToken as string;
  return cachedAdminToken;
}

test("E2E: Backend Health Check responde com status ok", async () => {
  const res = await fetch(`${BACKEND_URL}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, "ok");
  assert.strictEqual(data.database, "connected");
});

test("E2E: Autenticação de Usuário e Geração de Token JWT", { skip: missingCredentialsReason }, async () => {
  assert.ok(E2E_EMAIL && E2E_PASSWORD, "Credenciais E2E não configuradas");
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  });
  assert.strictEqual(res.status, 201);
  const data = await res.json();
  assert.ok(data.accessToken, "Deve retornar um accessToken JWT válido");
  assert.strictEqual(data.user.email, E2E_EMAIL.trim().toLowerCase());
});

test("E2E: Endpoint do Dashboard Comercial (/dashboard/summary)", { skip: missingCredentialsReason }, async () => {
  const accessToken = await getAdminToken();

  const res = await fetch(`${BACKEND_URL}/dashboard/summary`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const summary = await res.json();
  assert.ok(summary.potentialClients !== undefined, "potentialClients deve existir");
  assert.ok(summary.criticalOpportunities !== undefined, "criticalOpportunities deve existir");
  assert.ok(Array.isArray(summary.topRegions), "topRegions deve ser array");
});

test("E2E: Endpoint de Leads B2B (/leads)", { skip: missingCredentialsReason }, async () => {
  const accessToken = await getAdminToken();

  const res = await fetch(`${BACKEND_URL}/leads?page=1&pageSize=10`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.items), "data.items deve ser array");
  assert.ok(typeof data.total === "number", "data.total deve ser number");

  if (data.items.length > 0) {
    const lead = data.items[0];
    assert.ok(lead.id, "lead.id deve existir");
    assert.ok(lead.company || lead.companyName, "lead deve ter dados de empresa");
    assert.ok(typeof lead.score === "number" || typeof lead.company?.score === "number", "score deve ser número");
  }
});

test("E2E: Endpoint do Funil Comercial (/pipeline)", { skip: missingCredentialsReason }, async () => {
  const accessToken = await getAdminToken();

  const res = await fetch(`${BACKEND_URL}/pipeline`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const pipeline = await res.json();
  assert.ok(typeof pipeline.total === "number");
  assert.ok(pipeline.stages);
  assert.ok(pipeline.stages.NEW);
  assert.ok(pipeline.stages.CONVERTED);
});

test("E2E: Endpoint de Cidades Monitoradas (/cities)", { skip: missingCredentialsReason }, async () => {
  const accessToken = await getAdminToken();
  const res = await fetch(`${BACKEND_URL}/cities`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const cities = await res.json();
  assert.ok(Array.isArray(cities));
  assert.ok(cities.length > 0);
  assert.ok(cities.some((c: any) => c.name === "Tupã" || c.name === "Garça"));
});

test("E2E: Endpoint de CNAEs Monitorados (/cnaes)", { skip: missingCredentialsReason }, async () => {
  const accessToken = await getAdminToken();
  const res = await fetch(`${BACKEND_URL}/cnaes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(res.status, 200);
  const cnaes = await res.json();
  assert.ok(Array.isArray(cnaes));
  assert.ok(cnaes.length > 0);
});

test("E2E: Servidor Frontend Dev Server responde em http://localhost:8080", async () => {
  const res = await fetch(FRONTEND_URL, { redirect: "manual" });
  assert.ok(res.status === 200 || res.status === 307 || res.status === 302);
});
