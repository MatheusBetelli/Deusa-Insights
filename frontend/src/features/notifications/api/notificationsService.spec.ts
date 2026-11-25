import assert from "node:assert/strict";
import test from "node:test";
import { notificationsService } from "@/features/notifications/api/notificationsService";

test("notificationsService - declara método getNotifications", () => {
  assert.equal(typeof notificationsService.getNotifications, "function");
});
