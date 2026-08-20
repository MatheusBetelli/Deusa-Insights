import "reflect-metadata";
import assert from "node:assert";
import { test } from "node:test";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { UnauthorizedException } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "./auth.guard";
import { ROLES_KEY } from "./roles.decorator";
import { CitiesController } from "../cities/cities.controller";
import { CnaesController } from "../cnaes/cnaes.controller";
import { CompaniesController } from "../companies/companies.controller";
import { DashboardController } from "../dashboard/dashboard.controller";
import { ImportsController } from "../imports/imports.controller";
import { LeadInteractionsController } from "../lead-interactions/lead-interactions.controller";
import { LeadsController } from "../leads/leads.controller";
import { MapOpportunitiesController } from "../map-opportunities/map-opportunities.controller";
import { NotificationsController } from "../notifications/notifications.controller";
import { PipelineController } from "../pipeline/pipeline.controller";
import { UsersController } from "../users/users.controller";

const guardedControllers = [
  CitiesController,
  CnaesController,
  CompaniesController,
  DashboardController,
  ImportsController,
  LeadInteractionsController,
  LeadsController,
  MapOpportunitiesController,
  NotificationsController,
  PipelineController,
  UsersController,
];

test("controllers de negocio exigem AuthGuard no backend", () => {
  for (const controller of guardedControllers) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    assert.ok(
      guards.includes(AuthGuard),
      `${controller.name} deve declarar AuthGuard para nao depender apenas do frontend`,
    );
  }
});

test("token de redefinicao de senha nao pode autenticar chamadas da API", async () => {
  const guard = new AuthGuard(
    { verifyAsync: async () => ({ sub: "user-1", type: "password_reset" }) } as any,
    { get: () => "test-secret" } as any,
    { user: { findUnique: async () => ({ id: "user-1" }) } } as any,
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: "Bearer reset-token" } }),
    }),
  } as any;

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test("token legado sem tipo e versão não pode autenticar chamadas da API", async () => {
  const guard = new AuthGuard(
    { verifyAsync: async () => ({ sub: "user-1" }) } as any,
    { get: () => "test-secret" } as any,
    { user: { findUnique: async () => ({ id: "user-1", updatedAt: new Date() }) } } as any,
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: "Bearer legacy-token" } }),
    }),
  } as any;

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test("token de acesso atual permanece válido quando a versão da conta confere", async () => {
  const updatedAt = new Date("2026-08-19T12:00:00.000Z");
  const request: any = { headers: { authorization: "Bearer access-token" } };
  const guard = new AuthGuard(
    {
      verifyAsync: async () => ({
        sub: "user-1",
        type: "access",
        ver: updatedAt.getTime(),
      }),
    } as any,
    { get: () => "test-secret" } as any,
    {
      user: {
        findUnique: async () => ({
          id: "user-1",
          name: "Usuário",
          email: "usuario@example.com",
          role: UserRole.SALES,
          updatedAt,
        }),
      },
    } as any,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as any;

  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.user.sub, "user-1");
  assert.equal(request.user.role, UserRole.SALES);
});

test("operacoes administrativas declaram papeis no backend", () => {
  const createUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.createUser);
  const deleteUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.deleteUser);
  const listUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findAll);
  const getUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findById);
  const importRoles = Reflect.getMetadata(ROLES_KEY, ImportsController);
  const updateCompanyRoles = Reflect.getMetadata(
    ROLES_KEY,
    CompaniesController.prototype.update,
  );
  const validateLocationRoles = Reflect.getMetadata(
    ROLES_KEY,
    CompaniesController.prototype.validateLocation,
  );

  assert.deepStrictEqual(createUserRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(deleteUserRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(listUserRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(getUserRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(importRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(updateCompanyRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(validateLocationRoles, [UserRole.ADMIN, UserRole.MANAGER]);
});
