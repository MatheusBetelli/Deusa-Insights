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
export const COMMERCIAL_ACTION_MUTATION_KEY = "commercialActionMutation";
export const FrozenDatasetReadOnly = () => SetMetadata(FROZEN_DATASET_READ_ONLY_KEY, true);
export const CommercialActionMutation = () => SetMetadata(COMMERCIAL_ACTION_MUTATION_KEY, true);

function parseBooleanFlag(value: string | boolean | undefined | null): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  return value.trim().toLowerCase() === "true";
}

export function areDatasetMutationsEnabled(configService: ConfigService): boolean {
  const nodeEnv = configService.get<string>("NODE_ENV")?.trim().toLowerCase() ?? "development";
  const configuredValue = parseBooleanFlag(configService.get<string | boolean>("ENABLE_LEAD_MUTATIONS"));

  if (configuredValue === undefined) {
    return nodeEnv !== "production";
  }

  return configuredValue;
}

function areCommercialActionsEnabled(configService: ConfigService): boolean {
  const configuredValue = parseBooleanFlag(
    configService.get<string | boolean>("ENABLE_COMMERCIAL_ACTIONS"),
  );
  return configuredValue ?? true;
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
    const isCommercialAction = this.reflector.getAllAndOverride<boolean>(
      COMMERCIAL_ACTION_MUTATION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!MUTATING_METHODS.has(request.method.toUpperCase()) || isReadOnlyHandler) {
      return true;
    }
    if (areDatasetMutationsEnabled(this.configService)) {
      return true;
    }
    if (isCommercialAction && areCommercialActionsEnabled(this.configService)) {
      return true;
    }

    this.auditLogger.logEvent({
      action: isCommercialAction ? "COMMERCIAL_ACTION_MUTATION_BLOCKED" : "DATA_MUTATION_BLOCKED",
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
      isCommercialAction
        ? "Acoes comerciais estao desabilitadas neste ambiente"
        : "Alteracoes de leads, empresas e importacoes estao desabilitadas neste ambiente",
    );
  }
}
