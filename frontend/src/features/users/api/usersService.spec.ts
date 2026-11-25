import test from "node:test";
import assert from "node:assert/strict";
import { usersService } from "@/features/users/api/usersService";

test("usersService - declara método de listagem de usuários", () => {
  assert.equal(typeof usersService.getUsers, "function");
});
