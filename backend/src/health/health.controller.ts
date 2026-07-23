import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Controller("health")
export class HealthController {
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
      return {
        status: "error",
        database: "disconnected",
        error: err instanceof Error ? err.message : "Database connection failed",
        timestamp: new Date().toISOString(),
      };
    }
  }
}
