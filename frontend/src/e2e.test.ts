import assert from "node:assert";
import { test } from "node:test";

const BACKEND_URL = process.env.E2E_BACKEND_URL ?? "http://localhost:3001";
const FRONTEND_URL = process.env.E2E_FRONTEND_URL ?? "http://localhost:8080";
const AUTH_ORIGIN = process.env.E2E_AUTH_ORIGIN ?? FRONTEND_URL;
const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;
const missingCredentialsReason =
  E2E_EMAIL && E2E_PASSWORD
    ? false
    : "Defina E2E_EMAIL e E2E_PASSWORD para executar testes autenticados";

let cachedSessionCookie: string | null = null;

function requireSessionCookie(response: Response) {
  const setCookie = response.headers.get("set-cookie");
  if (!setCookie) throw new Error("Resposta de login sem cookie de sessão");
  return setCookie;
}

async function getSessionCookie() {
  if (cachedSessionCookie) return cachedSessionCookie;
  assert.ok(E2E_EMAIL && E2E_PASSWORD, "Credenciais E2E não configuradas");
  const loginRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: AUTH_ORIGIN },
    body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
  });
  assert.strictEqual(loginRes.status, 201);
  const data = await loginRes.json();
  assert.equal("accessToken" in data, false, "O token não deve ser exposto no JSON");
  const setCookie = requireSessionCookie(loginRes);
  assert.ok(setCookie.includes("auth_token="), "Deve definir o cookie de sessão");
  assert.ok(setCookie.includes("HttpOnly"), "O cookie de sessão deve ser HttpOnly");
  cachedSessionCookie = setCookie.split(";", 1)[0];
  return cachedSessionCookie;
}

test("E2E: Backend Health Check responde com status ok", async () => {
  const res = await fetch(`${BACKEND_URL}/health`);
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, "ok");
  assert.strictEqual(data.database, "connected");
});

test(
  "E2E: Autenticação usa cookie de sessão HttpOnly",
  { skip: missingCredentialsReason },
  async () => {
    assert.ok(E2E_EMAIL && E2E_PASSWORD, "Credenciais E2E não configuradas");
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: AUTH_ORIGIN },
      body: JSON.stringify({ email: E2E_EMAIL, password: E2E_PASSWORD }),
    });
    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.equal("accessToken" in data, false, "O token não deve ser exposto no JSON");
    const setCookie = requireSessionCookie(res);
    assert.ok(setCookie.includes("auth_token="), "Deve definir o cookie de sessão");
    assert.ok(setCookie.includes("HttpOnly"), "O cookie de sessão deve ser HttpOnly");
    assert.strictEqual(data.user.email, E2E_EMAIL.trim().toLowerCase());
  },
);

test(
  "E2E: Endpoint do Dashboard Comercial (/dashboard/summary)",
  { skip: missingCredentialsReason },
  async () => {
    const sessionCookie = await getSessionCookie();

    const res = await fetch(`${BACKEND_URL}/dashboard/summary`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const summary = await res.json();
    assert.ok(summary.potentialClients !== undefined, "potentialClients deve existir");
    assert.ok(summary.criticalOpportunities !== undefined, "criticalOpportunities deve existir");
    assert.ok(Array.isArray(summary.topRegions), "topRegions deve ser array");
  },
);

test("E2E: Endpoint de Leads B2B (/leads)", { skip: missingCredentialsReason }, async () => {
  const sessionCookie = await getSessionCookie();

  const res = await fetch(`${BACKEND_URL}/leads?page=1&pageSize=10`, {
    headers: { Cookie: sessionCookie },
  });
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.ok(Array.isArray(data.items), "data.items deve ser array");
  assert.ok(typeof data.total === "number", "data.total deve ser number");

  if (data.items.length > 0) {
    const lead = data.items[0];
    assert.ok(lead.id, "lead.id deve existir");
    assert.ok(lead.company || lead.companyName, "lead deve ter dados de empresa");
    assert.ok(
      typeof lead.score === "number" || typeof lead.company?.score === "number",
      "score deve ser número",
    );
  }
});

test(
  "E2E: Endpoint do Funil Comercial (/pipeline)",
  { skip: missingCredentialsReason },
  async () => {
    const sessionCookie = await getSessionCookie();

    const res = await fetch(`${BACKEND_URL}/pipeline`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const pipeline = await res.json();
    assert.ok(typeof pipeline.total === "number");
    assert.ok(pipeline.stages);
    assert.ok(pipeline.stages.NEW);
    assert.ok(pipeline.stages.CONVERTED);
  },
);

test(
  "E2E: Endpoint de Cidades Monitoradas (/cities)",
  { skip: missingCredentialsReason },
  async () => {
    const sessionCookie = await getSessionCookie();
    const res = await fetch(`${BACKEND_URL}/cities`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const cities: unknown = await res.json();
    assert.ok(Array.isArray(cities));
    assert.ok(cities.length > 0);
    assert.ok(
      cities.some(
        (city: unknown) =>
          typeof city === "object" &&
          city !== null &&
          "name" in city &&
          (city.name === "Tupã" || city.name === "Garça"),
      ),
    );
  },
);

test(
  "E2E: Endpoint de CNAEs Monitorados (/cnaes)",
  { skip: missingCredentialsReason },
  async () => {
    const sessionCookie = await getSessionCookie();
    const res = await fetch(`${BACKEND_URL}/cnaes`, {
      headers: { Cookie: sessionCookie },
    });
    assert.strictEqual(res.status, 200);
    const cnaes = await res.json();
    assert.ok(Array.isArray(cnaes));
    assert.ok(cnaes.length > 0);
  },
);

test("E2E: Servidor Frontend Dev Server responde em http://localhost:8080", async () => {
  const res = await fetch(FRONTEND_URL, { redirect: "manual" });
  assert.ok(res.status === 200 || res.status === 307 || res.status === 302);
});
