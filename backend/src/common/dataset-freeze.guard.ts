import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { AuditLoggerService } from "./audit-logger.service";
import { AuditableHttpRequest, getRequestPath } from "./auditable-http.types";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
export const FROZEN_DATASET_READ_ONLY_KEY = "frozenDatasetReadOnly";
export const FrozenDatasetReadOnly = () => SetMetadata(FROZEN_DATASET_READ_ONLY_KEY, true);

export function areDatasetMutationsEnabled(configService: ConfigService): boolean {
  const nodeEnv = configService.get<string>("NODE_ENV")?.trim().toLowerCase() ?? "development";
  const configuredValue = configService.get<string | boolean>("ENABLE_LEAD_MUTATIONS");

  if (configuredValue === undefined || configuredValue === null || configuredValue === "") {
    return nodeEnv !== "production";
  }

  if (typeof configuredValue === "boolean") {
    return configuredValue;
  }

  return configuredValue.trim().toLowerCase() === "true";
}

@Injectable()
export class DatasetFreezeGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly auditLogger: AuditLoggerService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuditableHttpRequest>();
    const isReadOnlyHandler = this.reflector.getAllAndOverride<boolean>(
      FROZEN_DATASET_READ_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!MUTATING_METHODS.has(request.method.toUpperCase()) || isReadOnlyHandler) {
      return true;
    }
    if (areDatasetMutationsEnabled(this.configService)) {
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
      requestId: request.requestId,
    });

    throw new ForbiddenException(
      "Alteracoes de leads, empresas e importacoes estao desabilitadas neste ambiente",
    );
  }
}
