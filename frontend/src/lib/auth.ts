const AUTH_TOKEN_KEY = "deusa_auth_token";
const USER_DATA_KEY = "deusa_user_data";

const CONFIGURED_API_URL = import.meta?.env?.VITE_API_URL?.trim();
const API_URL = CONFIGURED_API_URL || (import.meta?.env?.PROD ? "" : "http://127.0.0.1:3001");
const REQUEST_TIMEOUT_MS = 45_000;

function buildAuthUrl(path: string): string {
  if (!API_URL) {
    throw new Error("VITE_API_URL não configurada para o ambiente de produção.");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(API_URL);
  } catch {
    throw new Error("VITE_API_URL possui formato inválido.");
  }
  if (!["http:", "https:"].includes(baseUrl.protocol)) {
    throw new Error("VITE_API_URL deve usar HTTP ou HTTPS.");
  }
  return new URL(path, `${API_URL.replace(/\/+$/, "")}/`).toString();
}

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

async function readError(response: Response, fallback: string) {
  if (response.status === 429) {
    return "Muitas tentativas de login em sequência. Aguarde 10 segundos e tente novamente.";
  }
  let message = fallback;
  try {
    const payload = await response.json();
    message = Array.isArray(payload.message)
      ? payload.message.join(", ")
      : payload.message || message;
  } catch {
    // keep fallback
  }
  return message;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  if (init.signal) return fetch(input, init);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export const AuthService = {
  login: async (email: string, password: string, rememberMe = true): Promise<User> => {
    const response = await fetchWithTimeout(buildAuthUrl("auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Credenciais inválidas."));
    }

    const data = (await response.json()) as {
      accessToken: string;
      user: { id: string; name: string; email: string; role: string };
    };

    const user: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    };

    if (hasBrowserStorage()) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(USER_DATA_KEY);
      sessionStorage.removeItem(AUTH_TOKEN_KEY);
      sessionStorage.removeItem(USER_DATA_KEY);

      const targetStorage = rememberMe ? localStorage : sessionStorage;
      targetStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
      targetStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    }

    return user;
  },

  getToken: (): string | null => {
    if (!hasBrowserStorage()) return null;
    return localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY);
  },

  logout: () => {
    if (!hasBrowserStorage()) return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    sessionStorage.removeItem(USER_DATA_KEY);
  },

  isAuthenticated: () => {
    if (!hasBrowserStorage()) return false;
    return !!(localStorage.getItem(AUTH_TOKEN_KEY) || sessionStorage.getItem(AUTH_TOKEN_KEY));
  },

  getUser: (): User | null => {
    if (!hasBrowserStorage()) return null;
    const data = localStorage.getItem(USER_DATA_KEY) || sessionStorage.getItem(USER_DATA_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as User;
    } catch {
      AuthService.logout();
      return null;
    }
  },

  getProfile: async (): Promise<User> => {
    const token = AuthService.getToken();
    const response = await fetchWithTimeout(buildAuthUrl("auth/me"), {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      if (response.status === 401) AuthService.logout();
      throw new Error(await readError(response, "Não foi possível carregar o perfil."));
    }

    const user = (await response.json()) as User;
    if (hasBrowserStorage()) {
      const storage = localStorage.getItem(AUTH_TOKEN_KEY) ? localStorage : sessionStorage;
      storage.setItem(USER_DATA_KEY, JSON.stringify(user));
    }
    return user;
  },

  changePassword: async (payload: ChangePasswordPayload) => {
    const token = AuthService.getToken();
    const response = await fetchWithTimeout(buildAuthUrl("auth/password"), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível alterar a senha."));
    }

    return (await response.json()) as { message: string };
  },

  forgotPassword: async (email: string): Promise<{ message: string }> => {
    try {
      const response = await fetchWithTimeout(buildAuthUrl("auth/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error(await readError(response, "Não foi possível enviar a solicitação."));
      }

      return (await response.json()) as { message: string };
    } catch (err) {
      if (
        err instanceof Error &&
        err.message !== "Failed to fetch" &&
        err.name !== "AbortError"
      ) {
        throw err;
      }
      throw new Error("Não foi possível contatar o serviço de recuperação de senha.");
    }
  },

  resetPassword: async (payload: {
    token: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{ message: string }> => {
    const response = await fetchWithTimeout(buildAuthUrl("auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(await readError(response, "Não foi possível redefinir a senha."));
    }

    return (await response.json()) as { message: string };
  },
};
