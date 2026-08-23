import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuditLoggerService } from "./audit-logger.service";
import { AuditableHttpRequest, getRequestPath } from "./auditable-http.types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class DatasetFreezeGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuditableHttpRequest>();
    if (!MUTATING_METHODS.has(request.method.toUpperCase()) || this.areMutationsEnabled()) {
      return true;
    }

    this.auditLogger.logEvent({
      action: "DATA_MUTATION_BLOCKED",
      outcome: "BLOCKED",
      userId: request.user?.sub,
      userEmail: request.user?.email,
      method: request.method.toUpperCase(),
      route: getRequestPath(request),
      statusCode: 403,
      ip: request.ip,
    });

    throw new ForbiddenException("Alteracoes de leads, empresas e importacoes estao desabilitadas neste ambiente");
  }

  private areMutationsEnabled(): boolean {
    const nodeEnv = this.configService.get<string>("NODE_ENV")?.trim().toLowerCase() ?? "development";
    const configuredValue = this.configService.get<string | boolean>("ENABLE_LEAD_MUTATIONS");

    if (configuredValue === undefined || configuredValue === null || configuredValue === "") {
      return nodeEnv !== "production";
    }

    if (typeof configuredValue === "boolean") {
      return configuredValue;
    }

    return configuredValue.trim().toLowerCase() === "true";
  }
}
