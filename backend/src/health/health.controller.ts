import { Controller, Get, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async checkHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: "ok",
        database: "connected",
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      this.logger.warn(`Database health check failed: ${err instanceof Error ? err.message : "unknown error"}`);
      return {
        status: "error",
        database: "disconnected",
        error: "Database connection failed",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
