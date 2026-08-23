import { AuthService } from "@/lib/auth";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const CONFIGURED_API_URL = import.meta?.env?.VITE_API_URL?.trim();
const API_URL = CONFIGURED_API_URL || (import.meta?.env?.PROD ? "" : "http://127.0.0.1:3001");
const REQUEST_TIMEOUT_MS = 45_000;

function buildUrl(path: string, query?: Record<string, string | number | undefined | null>) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new ApiError("Caminho de API inválido: apenas rotas relativas são permitidas.");
  }

  if (!API_URL) {
    throw new ApiError("VITE_API_URL não configurada para o ambiente de produção.");
  }
  const baseUrl = API_URL.replace(/\/+$/, "");
  let parsedBaseUrl: URL;
  try {
    parsedBaseUrl = new URL(baseUrl);
  } catch {
    throw new ApiError("VITE_API_URL possui formato inválido.");
  }
  if (!["http:", "https:"].includes(parsedBaseUrl.protocol)) {
    throw new ApiError("VITE_API_URL deve usar HTTP ou HTTPS.");
  }
  const url = new URL(`${baseUrl}${path}`);
  if (url.origin !== parsedBaseUrl.origin) {
    throw new ApiError("Caminho de API fora da origem configurada.");
  }
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit): Promise<Response> {
  const mergedInit: RequestInit = {
    credentials: "include",
    ...init,
  };
  if (mergedInit.signal) return fetch(input, mergedInit);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...mergedInit, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  try {
    const token = AuthService.getToken();
    const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetchWithTimeout(buildUrl(path, query), {
      ...options,
      headers,
    });

    // ── Sessão Expirada: Limpa storage e redireciona para /login ─────────────
    if (response.status === 401) {
      AuthService.logout();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
      throw new ApiError("Sessão expirada. Faça login novamente.", 401);
    }

    if (!response.ok) {
      let message = "Não foi possível carregar os dados da API.";
      try {
        const payload = await response.json();
        message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message || message;
      } catch {
        // Keep default friendly message.
      }
      throw new ApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("A requisição demorou muito para responder.", 408);
    }
    throw new ApiError("API indisponível. Verifique se o backend está rodando e tente novamente.");
  }
}

export async function apiTextRequest(
  path: string,
  options: RequestInit = {},
  query?: Record<string, string | number | undefined | null>,
): Promise<string> {
  try {
    const token = AuthService.getToken();
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetchWithTimeout(buildUrl(path, query), {
      ...options,
      headers,
    });

    if (response.status === 401) {
      AuthService.logout();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new ApiError("Sessão expirada. Faça login novamente.", 401);
    }

    if (!response.ok) {
      let message = "Não foi possível carregar os dados da API.";
      try {
        const payload = await response.json();
        message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message || message;
      } catch {
        // Keep default friendly message.
      }
      throw new ApiError(message, response.status);
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("API indisponível. Verifique se o backend está rodando e tente novamente.");
  }
}
