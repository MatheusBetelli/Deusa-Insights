type AuthenticatedRequestUser = {
  sub?: string;
  email?: string;
  role?: string;
};

export type AuditableHttpRequest = {
  method: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  body?: unknown;
  user?: AuthenticatedRequestUser;
};

export type AuthenticatedHttpRequest = AuditableHttpRequest & {
  user: AuthenticatedRequestUser & { sub: string };
};

export type AuditableHttpResponse = {
  statusCode: number;
};

export function getRequestPath(request: AuditableHttpRequest): string {
  const path = request.originalUrl ?? request.url ?? "/";
  return path.split("?", 1)[0] || "/";
}
