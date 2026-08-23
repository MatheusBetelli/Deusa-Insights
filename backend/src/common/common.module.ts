import { Global, Module } from "@nestjs/common";
import { AuditLoggerService } from "./audit-logger.service";
import { DatasetFreezeGuard } from "./dataset-freeze.guard";

@Global()
@Module({
  providers: [AuditLoggerService, DatasetFreezeGuard],
  exports: [AuditLoggerService, DatasetFreezeGuard],
})
export class CommonModule {}
