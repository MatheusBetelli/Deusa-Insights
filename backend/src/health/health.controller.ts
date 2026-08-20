import { Controller, Get, Logger, ServiceUnavailableException } from "@nestjs/common";
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
    } catch {
      this.logger.warn("Database health check failed.");
      throw new ServiceUnavailableException({
        status: "error",
        database: "disconnected",
        error: "Database connection failed",
        timestamp: new Date().toISOString(),
      });
    }
  }
}
