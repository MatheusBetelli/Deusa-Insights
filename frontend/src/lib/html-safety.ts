const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

export function escapeHtmlAttribute(value: unknown): string {
  return escapeHtml(value);
}

export function safePathSegment(value: unknown): string {
  return encodeURIComponent(String(value ?? ""));
}
