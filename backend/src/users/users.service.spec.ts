import test from "node:test";
import assert from "node:assert/strict";
import { BadRequestException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
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
