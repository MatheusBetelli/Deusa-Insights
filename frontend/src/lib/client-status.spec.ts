import assert from "node:assert/strict";
import test from "node:test";
import { hasCurrentClientAccount } from "./client-status";

test("cliente ativo depende exclusivamente de ClientAccount.isCurrentClient", () => {
  assert.equal(hasCurrentClientAccount(undefined), false);
  assert.equal(hasCurrentClientAccount([{ isCurrentClient: false }]), false);
  assert.equal(hasCurrentClientAccount([{ isCurrentClient: true }]), true);
});
