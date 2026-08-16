import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { NotificationsService } from "./notifications.service";

@UseGuards(AuthGuard)
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getNotifications() {
    return this.notificationsService.getOperationalNotifications();
  }
}
