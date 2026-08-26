import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import {
  assertSalesCannotManageLeadAssignment,
  buildLeadAccessWhere,
  scopeCompanyWhere,
  scopeLeadWhere,
} from "./lead-access.policy";

test("administrador e gerente acessam a carteira completa", () => {
  assert.deepEqual(
    buildLeadAccessWhere({ sub: "admin-1", role: "ADMIN", email: "admin@example.com" }),
    {},
  );
  assert.deepEqual(scopeLeadWhere({ status: "NEW" }, { sub: "manager-1", role: "MANAGER" }), {
    status: "NEW",
  });
});

test("vendedor fica restrito ao vínculo legado ou ao perfil do próprio e-mail", () => {
  const where = buildLeadAccessWhere({
    sub: "sales-1",
    email: "sales@example.com",
    role: "SALES",
  });

  assert.deepEqual(where, {
    OR: [
      { assignedToId_legacy: "sales-1" },
      { assignedTo: { is: { email: "sales@example.com" } } },
    ],
  });
  assert.match(
    JSON.stringify(
      scopeCompanyWhere(
        { id: "company-1" },
        {
          sub: "sales-1",
          email: "sales@example.com",
          role: "SALES",
        },
      ),
    ),
    /assignedToId_legacy/,
  );
});

test("vendedor não pode reatribuir nem recalcular lead", () => {
  const actor = { sub: "sales-1", email: "sales@example.com", role: "SALES" };

  assert.throws(
    () => assertSalesCannotManageLeadAssignment(actor, { assignedToId: "profile-2" }),
    ForbiddenException,
  );
  assert.throws(
    () => assertSalesCannotManageLeadAssignment(actor, { score: 99 }),
    ForbiddenException,
  );
  assert.doesNotThrow(() =>
    assertSalesCannotManageLeadAssignment(actor, { assignedToId: undefined }),
  );
});
