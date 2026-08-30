import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { publicRuntimeEnv } from "./lib/runtime-env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const API_PROXY_PREFIX = "/api";

function readRuntimeBinding(env: unknown, name: string): string | undefined {
  if (!env || typeof env !== "object") return undefined;
  const value = (env as Record<string, unknown>)[name];
  return typeof value === "string" ? value.trim() : undefined;
}

export function resolveBackendOrigin(env: unknown): string {
  const configured =
    readRuntimeBinding(env, "BACKEND_ORIGIN") ||
    process.env.BACKEND_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:3001");

  if (!configured) {
    throw new Error("BACKEND_ORIGIN nao configurada para o proxy de producao.");
  }

  const parsed = new URL(configured);
  const isProduction = process.env.NODE_ENV === "production";
  if (
    (isProduction && parsed.protocol !== "https:") ||
    (!isProduction && !["http:", "https:"].includes(parsed.protocol)) ||
    parsed.username ||
    parsed.password ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    throw new Error("BACKEND_ORIGIN deve ser uma origem HTTPS sem caminho ou credenciais.");
  }

  return parsed.origin;
}

function isApiProxyPath(pathname: string): boolean {
  return pathname === API_PROXY_PREFIX || pathname.startsWith(`${API_PROXY_PREFIX}/`);
}

export function buildBackendUrl(requestUrl: URL, env: unknown): URL {
  const upstreamPath = requestUrl.pathname.slice(API_PROXY_PREFIX.length) || "/";
  const upstreamUrl = new URL(resolveBackendOrigin(env));

  // Atribuir pathname e search separadamente impede que //host seja reinterpretado
  // como uma nova origem. O destino do proxy permanece sempre BACKEND_ORIGIN.
  upstreamUrl.pathname = upstreamPath.startsWith("/") ? upstreamPath : `/${upstreamPath}`;
  upstreamUrl.search = requestUrl.search;
  return upstreamUrl;
}

async function proxyApiRequest(request: Request, env: unknown): Promise<Response> {
  const requestUrl = new URL(request.url);
  const upstreamUrl = buildBackendUrl(requestUrl, env);
  const headers = new Headers(request.headers);

  // O host e o comprimento devem ser calculados novamente pelo fetch para o upstream fixo.
  headers.delete("host");
  headers.delete("content-length");
  headers.delete("connection");

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
    signal: request.signal,
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = request.body;
    init.duplex = "half";
  }

  const response = await fetch(new Request(upstreamUrl, init));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

function getContentSecurityPolicy(): string {
  const connectOrigins = new Set<string>(["'self'"]);

  if (publicRuntimeEnv.DEV) {
    connectOrigins.add("http://localhost:*");
    connectOrigins.add("http://127.0.0.1:*");
    connectOrigins.add("ws:");
    connectOrigins.add("wss:");
  }

  const configuredApiUrl = publicRuntimeEnv.VITE_API_URL?.trim();
  if (configuredApiUrl) {
    try {
      const parsedUrl = new URL(configuredApiUrl);
      if (parsedUrl.protocol === "https:" || parsedUrl.protocol === "http:") {
        connectOrigins.add(parsedUrl.origin);
      }
    } catch {
      // Ignorar URL malformada
    }
  }

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self' data:",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org",
    `connect-src ${Array.from(connectOrigins).join(" ")}`,
    "worker-src 'self' blob:",
  ].join("; ");
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function withSecurityHeaders(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-frame-options", "DENY");
  headers.set("content-security-policy", getContentSecurityPolicy());
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  headers.set("permissions-policy", "camera=(), microphone=()");
  if (new URL(request.url).protocol === "https:") {
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const requestUrl = new URL(request.url);
      if (requestUrl.pathname === "/healthz") {
        return withSecurityHeaders(
          new Response(request.method === "HEAD" ? null : "ok", {
            status: 200,
            headers: {
              "cache-control": "no-store",
              "content-type": "text/plain; charset=utf-8",
            },
          }),
          request,
        );
      }
      if (isApiProxyPath(requestUrl.pathname)) {
        return withSecurityHeaders(await proxyApiRequest(request, env), request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(brandedErrorResponse(), request);
    }
  },
};
