import { Injectable, Logger } from "@nestjs/common";
import { maskEmailForLogs } from "./lgpd.utils";

export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "EXPORT_DATA"
  | "SEARCH_LEADS"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_SUCCESS"
  | "PASSWORD_CHANGE"
  | "DATA_MUTATION"
  | "DATA_MUTATION_BLOCKED"
  | "IMPORT_DATA"
  | "OPT_OUT_REQUEST";

export type AuditEvent = {
  action: AuditAction;
  outcome?: "SUCCESS" | "FAILURE" | "BLOCKED";
  userId?: string;
  userEmail?: string;
  details?: string;
  method?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  ip?: string;
  timestamp?: Date;
};

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger("LGPDAuditLogger");

  logEvent(event: AuditEvent): void {
    this.logger.log(
      JSON.stringify({
        event: "security.audit",
        timestamp: (event.timestamp ?? new Date()).toISOString(),
        action: event.action,
        outcome: event.outcome ?? "SUCCESS",
        actor: {
          id: event.userId ?? "anonymous",
          email: maskEmailForLogs(event.userEmail),
        },
        method: event.method,
        route: event.route,
        statusCode: event.statusCode,
        durationMs: event.durationMs,
        ip: event.ip,
        details: event.details,
      }),
    );
  }
}
