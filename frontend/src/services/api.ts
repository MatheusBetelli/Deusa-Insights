import { AuthService } from "@/lib/auth";

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

function buildUrl(path: string, query?: Record<string, string | number | undefined | null>) {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  try {
    const token = AuthService.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(path, query), {
      ...options,
      headers,
    });

    // ── Sessão Expirada: Limpa storage e redireciona para /login ─────────────
    if (response.status === 401) {
      AuthService.logout();
      if (typeof window !== "undefined") {
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
      ...(options.headers as Record<string, string> ?? {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(buildUrl(path, query), {
      ...options,
      headers,
    });

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
