
const AUTH_TOKEN_KEY = "deusa_auth_token";
const USER_DATA_KEY = "deusa_user_data";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

function hasBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  location: string;
}

export const AuthService = {
  login: async (email: string, password: string): Promise<User> => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      let message = "Credenciais inválidas.";
      try {
        const payload = await response.json();
        message = Array.isArray(payload.message)
          ? payload.message.join(", ")
          : payload.message || message;
      } catch {
        // keep default message
      }
      throw new Error(message);
    }

    const data = await response.json() as { accessToken: string; user: { id: string; name: string; email: string; role: string } };

    const user: User = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
      location: "SP",
    };

    if (hasBrowserStorage()) {
      localStorage.setItem(AUTH_TOKEN_KEY, data.accessToken);
      localStorage.setItem(USER_DATA_KEY, JSON.stringify(user));
    }

    return user;
  },

  getToken: (): string | null => {
    if (!hasBrowserStorage()) return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  logout: () => {
    if (!hasBrowserStorage()) return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(USER_DATA_KEY);
  },

  isAuthenticated: () => {
    if (!hasBrowserStorage()) return false;
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  },

  getUser: (): User | null => {
    if (!hasBrowserStorage()) return null;
    const data = localStorage.getItem(USER_DATA_KEY);
    return data ? JSON.parse(data) : null;
  },
};
