import assert from "node:assert/strict";
import test from "node:test";
import { notificationsService } from "./notificationsService";

test("notificationsService - declara método getNotifications", () => {
  assert.equal(typeof notificationsService.getNotifications, "function");
});
