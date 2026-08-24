import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, catchError, tap, throwError } from "rxjs";
import { AuditAction, AuditLoggerService } from "./audit-logger.service";
import {
  AuditableHttpRequest,
  AuditableHttpResponse,
  getRequestPath,
} from "./auditable-http.types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readString(value: unknown, key: string): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  const property = (value as Record<string, unknown>)[key];
  return typeof property === "string" ? property : undefined;
}

function classifyAction(method: string, route: string): AuditAction | undefined {
  if (method === "POST" && route === "/auth/login") return "LOGIN";
  if (method === "POST" && route === "/auth/logout") return "LOGOUT";
  if (method === "POST" && route === "/auth/forgot-password") return "PASSWORD_RESET_REQUEST";
  if (method === "POST" && route === "/auth/reset-password") return "PASSWORD_RESET_SUCCESS";
  if (method === "PATCH" && route === "/auth/password") return "PASSWORD_CHANGE";
  if (method === "GET" && route === "/leads/export.csv") return "EXPORT_DATA";
  if (MUTATING_METHODS.has(method) && route.startsWith("/imports")) return "IMPORT_DATA";
  if (MUTATING_METHODS.has(method)) return "DATA_MUTATION";
  return undefined;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly auditLogger: AuditLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditableHttpRequest>();
    const response = context.switchToHttp().getResponse<AuditableHttpResponse>();
    const method = request.method.toUpperCase();
    const route = getRequestPath(request);
    const action = classifyAction(method, route);

    if (!action) return next.handle();

    const startedAt = Date.now();
    return next.handle().pipe(
      tap((result: unknown) => {
        this.logRequest(action, request, result, {
          outcome: "SUCCESS",
          statusCode: response.statusCode,
          durationMs: Date.now() - startedAt,
        });
      }),
      catchError((error: unknown) => {
        this.logRequest(action, request, undefined, {
          outcome: "FAILURE",
          statusCode: error instanceof HttpException ? error.getStatus() : 500,
          durationMs: Date.now() - startedAt,
        });
        return throwError(() => error);
      }),
    );
  }

  private logRequest(
    action: AuditAction,
    request: AuditableHttpRequest,
    result: unknown,
    outcome: { outcome: "SUCCESS" | "FAILURE"; statusCode: number; durationMs: number },
  ): void {
    const responseUser = this.readResponseUser(result);
    const bodyEmail = action === "LOGIN" || action === "PASSWORD_RESET_REQUEST"
      ? readString(request.body, "email")
      : undefined;

    this.auditLogger.logEvent({
      action,
      ...outcome,
      userId: request.user?.sub ?? responseUser?.id,
      userEmail: request.user?.email ?? responseUser?.email ?? bodyEmail,
      method: request.method.toUpperCase(),
      route: getRequestPath(request),
      ip: request.ip,
    });
  }

  private readResponseUser(result: unknown): { id?: string; email?: string } | undefined {
    if (!result || typeof result !== "object") return undefined;
    const user = (result as Record<string, unknown>).user;
    if (!user || typeof user !== "object") return undefined;
    return {
      id: readString(user, "id"),
      email: readString(user, "email"),
    };
  }
}
