import { Injectable, Logger } from "@nestjs/common";
import { maskEmailForLogs } from "./lgpd.utils";

export type AuditEvent = {
  userId: string;
  userEmail: string;
  action: "LOGIN" | "LOGOUT" | "EXPORT_DATA" | "SEARCH_LEADS" | "PASSWORD_RESET_REQUEST" | "PASSWORD_RESET_SUCCESS" | "OPT_OUT_REQUEST";
  details?: string;
  ip?: string;
  timestamp?: Date;
};

@Injectable()
export class AuditLoggerService {
  private readonly logger = new Logger("LGPDAuditLogger");

  logEvent(event: AuditEvent) {
    const time = (event.timestamp || new Date()).toISOString();
    const maskedEmail = maskEmailForLogs(event.userEmail);
    const details = event.details ? ` | Detalhes: ${event.details}` : "";
    const ipStr = event.ip ? ` | IP: ${event.ip}` : "";

    this.logger.log(
      `[AUDIT LGPD] [${time}] User: ${event.userId} (${maskedEmail}) | Ação: ${event.action}${details}${ipStr}`
    );
  }
}
