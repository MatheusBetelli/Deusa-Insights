import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import * as crypto from "node:crypto";
import { UsersService } from "./users.service";

test("deleteUser impede excluir o último administrador", async () => {
  let deleted = false;
  const tx = {
    user: {
      findUnique: async () => ({ id: "admin-1", role: UserRole.ADMIN }),
      count: async () => 1,
      delete: async () => {
        deleted = true;
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new UsersService(prisma as never);

  await assert.rejects(() => service.deleteUser("admin-1", "admin-2"), BadRequestException);
  assert.equal(deleted, false);
});

test("deleteUser permite remover administrador de teste quando outro administrador permanece", async () => {
  const operations: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({
        id: "admin-test-1",
        email: "admin.test@example.com",
        role: UserRole.ADMIN,
      }),
      count: async () => 2,
      delete: async () => {
        operations.push("delete-user");
        return { id: "admin-test-1" };
      },
    },
    userMapping: { findUnique: async () => null },
    profile: { findUnique: async () => null },
    lead: { updateMany: async () => operations.push("unlink-leads") },
    leadInteraction: { updateMany: async () => operations.push("unlink-interactions") },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new UsersService(prisma as never);

  await service.deleteUser("admin-test-1", "admin-main-1");
  assert.deepEqual(operations, ["unlink-leads", "unlink-interactions", "delete-user"]);
});

test("deleteUser desvincula interações legadas antes de remover o usuário", async () => {
  const operations: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({ id: "sales-1", role: UserRole.SALES }),
      count: async () => 2,
      delete: async () => {
        operations.push("delete-user");
        return { id: "sales-1" };
      },
    },
    userMapping: { findUnique: async () => null },
    lead: {
      updateMany: async () => {
        operations.push("unlink-leads");
      },
    },
    leadInteraction: {
      updateMany: async () => {
        operations.push("unlink-interactions");
      },
    },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new UsersService(prisma as never);

  await service.deleteUser("sales-1", "admin-1");
  assert.deepEqual(operations, ["unlink-leads", "unlink-interactions", "delete-user"]);
});

test("deleteUser remove mapeamento obsoleto sem apagar o perfil histórico", async () => {
  const operations: string[] = [];
  const tx = {
    user: {
      findUnique: async () => ({ id: "sales-1", role: UserRole.SALES }),
      delete: async () => {
        operations.push("delete-user");
        return { id: "sales-1" };
      },
    },
    userMapping: {
      findUnique: async () => ({ cuid: "sales-1", uuid: "profile-1" }),
      delete: async () => {
        operations.push("delete-mapping");
      },
    },
    lead: { updateMany: async () => operations.push("unlink-leads") },
    leadInteraction: { updateMany: async () => operations.push("unlink-interactions") },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };
  const service = new UsersService(prisma as never);

  await service.deleteUser("sales-1", "admin-1");
  assert.deepEqual(operations, [
    "unlink-leads",
    "unlink-interactions",
    "delete-mapping",
    "delete-user",
  ]);
});

test("deleteUser desvincula perfil por e-mail quando o mapeamento legado não existe", async () => {
  let leadWhere: unknown;
  const tx = {
    user: {
      findUnique: async () => ({
        id: "sales-1",
        email: "sales@example.com",
        role: UserRole.SALES,
      }),
      delete: async () => ({ id: "sales-1" }),
    },
    userMapping: { findUnique: async () => null },
    profile: { findUnique: async () => ({ id: "profile-1" }) },
    lead: {
      updateMany: async (args: { where: unknown }) => {
        leadWhere = args.where;
      },
    },
    leadInteraction: { updateMany: async () => ({ count: 0 }) },
  };
  const prisma = {
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  };

  await new UsersService(prisma as never).deleteUser("sales-1", "admin-1");

  assert.match(JSON.stringify(leadWhere), /profile-1/);
  assert.match(JSON.stringify(leadWhere), /sales-1/);
});

test("deleteUser converte conflito serializável em erro seguro para nova tentativa", async () => {
  const prisma = {
    $transaction: async () => {
      throw { code: "P2034" };
    },
  };
  const service = new UsersService(prisma as never);

  await assert.rejects(
    () => service.deleteUser("admin-1", "admin-2"),
    (error: unknown) =>
      error instanceof BadRequestException && error.message.includes("alterada simultaneamente"),
  );
});

test("createInvitation normaliza o e-mail, cria conta INVITED e armazena somente o hash do token", async () => {
  let createdUserData: Record<string, unknown> | undefined;
  let createdInvitationData: Record<string, unknown> | undefined;
  const auditEvents: Array<{ action: string; userId?: string }> = [];
  const tx = {
    user: {
      findUnique: async () => null,
      create: async (args: { data: Record<string, unknown> }) => {
        createdUserData = args.data;
        return {
          id: "invited-1",
          name: args.data.name,
          email: args.data.email,
          role: args.data.role,
          status: "INVITED",
          createdAt: new Date("2026-08-31T00:00:00.000Z"),
          updatedAt: new Date("2026-08-31T00:00:00.000Z"),
        };
      },
      update: async () => {
        throw new Error("não esperado");
      },
    },
    userInvitation: {
      updateMany: async () => ({ count: 0 }),
      create: async (args: { data: Record<string, unknown> }) => {
        createdInvitationData = args.data;
        return args.data;
      },
    },
  };
  const service = new UsersService(
    {
      $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
    } as never,
    { logEvent: (event: { action: string; userId?: string }) => auditEvents.push(event) } as never,
  );
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFrontendUrl = process.env.FRONTEND_URL;
  const originalApiKey = process.env.RESEND_API_KEY;
  try {
    process.env.NODE_ENV = "test";
    process.env.FRONTEND_URL = "https://app.example.test";
    delete process.env.RESEND_API_KEY;

    const result = await service.createInvitation(
      { name: " Supervisora ", email: " SUPERVISORA@EXAMPLE.TEST ", role: UserRole.ADMIN },
      { id: "admin-1", email: "admin@example.test" },
    );

    assert.equal(createdUserData?.email, "supervisora@example.test");
    assert.equal(createdUserData?.status, "INVITED");
    assert.equal(createdUserData?.role, UserRole.ADMIN);
    assert.equal(typeof createdUserData?.passwordHash, "string");
    assert.equal(createdInvitationData?.userId, "invited-1");
    assert.equal(typeof createdInvitationData?.tokenHash, "string");
    assert.equal(String(createdInvitationData?.tokenHash).length, 64);
    const inviteLink = "inviteLink" in result ? result.inviteLink : "";
    assert.match(String(inviteLink), /^https:\/\/app\.example\.test\/set-password\?token=/);
    assert.equal(result.inviteSent, false);
    assert.equal(auditEvents[0]?.action, "USER_INVITATION_CREATED");
    assert.equal(auditEvents[0]?.userId, "admin-1");

    const token = new URL(String(inviteLink)).searchParams.get("token");
    assert.ok(token);
    assert.equal(
      createdInvitationData?.tokenHash,
      crypto.createHash("sha256").update(token).digest("hex"),
    );
    assert.notEqual(createdInvitationData?.tokenHash, token);
  } finally {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
    else process.env.FRONTEND_URL = originalFrontendUrl;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
  }
});
