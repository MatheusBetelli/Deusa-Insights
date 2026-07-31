export const API_URL = normalizeApiUrl(import.meta.env.VITE_API_URL ?? "");

function isCodespacesPreview() {
  if (typeof window === "undefined") return false;
  return /(?:githubpreview\.dev|preview\.app\.github\.dev|app\.github\.dev)$/.test(window.location.hostname);
}

function normalizeApiUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (!url) {
    return isCodespacesPreview() ? "" : "http://127.0.0.1:3001";
  }

  if (isCodespacesPreview() && /^https?:\/\/localhost(?::\d+)?$/i.test(url)) {
    return "";
  }

  return url;
}

export function buildUrl(path: string, query?: Record<string, string | number | undefined | null>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const target = normalizedPath.startsWith("http") ? normalizedPath : `${API_URL}${normalizedPath}`;

  const url = target.startsWith("http")
    ? new URL(target)
    : new URL(target, typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:3000");

  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  return url.toString();
}
