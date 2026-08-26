import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { NotificationsService } from "./notifications.service";

@UseGuards(AuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications(@Req() request: AuthenticatedHttpRequest) {
    return this.notificationsService.getOperationalNotifications(request.user);
  }
}
