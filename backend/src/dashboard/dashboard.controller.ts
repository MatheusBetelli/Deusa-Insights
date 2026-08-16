import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { DashboardService } from "./dashboard.service";
import { DashboardQueryDto } from "./dto/dashboard-query.dto";

@UseGuards(AuthGuard)
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("summary")
  summary(@Query() query: DashboardQueryDto) {
    return this.dashboardService.summary(query);
  }
}
