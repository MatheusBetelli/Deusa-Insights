import "reflect-metadata";
import assert from "node:assert";
import { test } from "node:test";
import { GUARDS_METADATA, PATH_METADATA } from "@nestjs/common/constants";
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
import {
  DatasetFreezeGuard,
  FROZEN_DATASET_READ_ONLY_KEY,
  MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
} from "../common/dataset-freeze.guard";

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

const frozenDatasetControllers = [
  CitiesController,
  CnaesController,
  CompaniesController,
  ImportsController,
  LeadInteractionsController,
  LeadsController,
];

type GuardTestRequest = {
  cookies?: Record<string, string>;
  headers: { authorization?: string; cookie?: string };
  user?: { sub?: string; role?: UserRole };
};

test("controllers de negocio exigem AuthGuard no backend", () => {
  for (const controller of guardedControllers) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    assert.ok(
      guards.includes(AuthGuard),
      `${controller.name} deve declarar AuthGuard para nao depender apenas do frontend`,
    );
  }

  for (const controller of frozenDatasetControllers) {
    const guards = Reflect.getMetadata(GUARDS_METADATA, controller) ?? [];
    assert.ok(
      guards.includes(DatasetFreezeGuard),
      `${controller.name} deve aplicar DatasetFreezeGuard para proteger a carteira congelada`,
    );
  }

  const deleteUserGuards =
    Reflect.getMetadata(GUARDS_METADATA, UsersController.prototype.deleteUser) ?? [];
  assert.equal(
    deleteUserGuards.includes(DatasetFreezeGuard),
    false,
    "DELETE /users/:id nao deve ser bloqueado pelo congelamento da carteira comercial",
  );
});

test("API nao expoe rotas de descoberta ou geocodificacao em lote", () => {
  const routePaths = [CompaniesController, MapOpportunitiesController].flatMap((controller) => {
    const prototype = controller.prototype as unknown as Record<string, unknown>;
    return Object.getOwnPropertyNames(prototype).flatMap((property) => {
      const handler = prototype[property];
      if (typeof handler !== "function") return [];
      const path = Reflect.getMetadata(PATH_METADATA, handler) as unknown;
      return typeof path === "string" ? [path] : [];
    });
  });

  assert.equal(routePaths.includes("geocode-batch-process"), false);
  assert.equal(routePaths.includes("verify-google-batch"), false);
  assert.equal(routePaths.includes("discover-region"), false);

  assert.equal(
    Reflect.getMetadata(
      FROZEN_DATASET_READ_ONLY_KEY,
      CompaniesController.prototype.getLocationCandidates,
    ),
    undefined,
    "geocodificacao nao deve ignorar o congelamento de escrita em producao",
  );
});

test("somente o endpoint de ajuste manual recebe a exceção específica do congelamento", () => {
  const locationAdjustment = Reflect.getMetadata(
    MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
    CompaniesController.prototype.updateLocation,
  );
  const genericCompanyUpdate = Reflect.getMetadata(
    MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
    CompaniesController.prototype.update,
  );
  const syncByCnpj = Reflect.getMetadata(
    MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
    CompaniesController.prototype.syncByCnpj,
  );
  const locationCandidates = Reflect.getMetadata(
    MANUAL_LOCATION_ADJUSTMENT_MUTATION_KEY,
    CompaniesController.prototype.getLocationCandidates,
  );

  assert.equal(locationAdjustment, true);
  assert.equal(genericCompanyUpdate, undefined);
  assert.equal(syncByCnpj, undefined);
  assert.equal(locationCandidates, undefined);
});

test("token de redefinicao de senha nao pode autenticar chamadas da API", async () => {
  const guard = new AuthGuard(
    { verifyAsync: async () => ({ sub: "user-1", type: "password_reset" }) } as never,
    { get: () => "test-secret" } as never,
    { user: { findUnique: async () => ({ id: "user-1" }) } } as never,
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: "Bearer reset-token" } }),
    }),
  } as never;

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test("token legado sem tipo e versão não pode autenticar chamadas da API", async () => {
  const guard = new AuthGuard(
    { verifyAsync: async () => ({ sub: "user-1" }) } as never,
    { get: () => "test-secret" } as never,
    { user: { findUnique: async () => ({ id: "user-1", updatedAt: new Date() }) } } as never,
  );
  const context = {
    switchToHttp: () => ({
      getRequest: () => ({ headers: { authorization: "Bearer legacy-token" } }),
    }),
  } as never;

  await assert.rejects(() => guard.canActivate(context), UnauthorizedException);
});

test("token de acesso atual permanece válido quando a versão da conta confere", async () => {
  const updatedAt = new Date("2026-08-19T12:00:00.000Z");
  const request: GuardTestRequest = { headers: { authorization: "Bearer access-token" } };
  const guard = new AuthGuard(
    {
      verifyAsync: async () => ({
        sub: "user-1",
        type: "access",
        ver: updatedAt.getTime(),
      }),
    } as never,
    { get: () => "test-secret" } as never,
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
    } as never,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.user?.sub, "user-1");
  assert.equal(request.user?.role, UserRole.SALES);
});

test("token de acesso armazenado em cookie httpOnly autentica requisição com sucesso", async () => {
  const updatedAt = new Date("2026-08-19T12:00:00.000Z");
  const request: GuardTestRequest = {
    cookies: { auth_token: "valid-cookie-token" },
    headers: {},
  };
  const guard = new AuthGuard(
    {
      verifyAsync: async (token: string) => {
        assert.equal(token, "valid-cookie-token");
        return {
          sub: "user-1",
          type: "access",
          ver: updatedAt.getTime(),
        };
      },
    } as never,
    { get: () => "test-secret" } as never,
    {
      user: {
        findUnique: async () => ({
          id: "user-1",
          name: "Usuário Cookie",
          email: "usuario.cookie@example.com",
          role: UserRole.ADMIN,
          updatedAt,
        }),
      },
    } as never,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.user?.sub, "user-1");
  assert.equal(request.user?.role, UserRole.ADMIN);
});

test("token de acesso extraído de cabeçalho Cookie bruto autentica com sucesso", async () => {
  const updatedAt = new Date("2026-08-19T12:00:00.000Z");
  const request: GuardTestRequest = {
    headers: { cookie: "other_cookie=123; auth_token=raw-header-cookie-token; session=xyz" },
  };
  const guard = new AuthGuard(
    {
      verifyAsync: async (token: string) => {
        assert.equal(token, "raw-header-cookie-token");
        return {
          sub: "user-2",
          type: "access",
          ver: updatedAt.getTime(),
        };
      },
    } as never,
    { get: () => "test-secret" } as never,
    {
      user: {
        findUnique: async () => ({
          id: "user-2",
          name: "Usuário Header Cookie",
          email: "header.cookie@example.com",
          role: UserRole.MANAGER,
          updatedAt,
        }),
      },
    } as never,
  );
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;

  assert.equal(await guard.canActivate(context), true);
  assert.equal(request.user?.sub, "user-2");
  assert.equal(request.user?.role, UserRole.MANAGER);
});

test("operacoes administrativas declaram papeis no backend", () => {
  const createUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.createUser);
  const deleteUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.deleteUser);
  const listUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findAll);
  const getUserRoles = Reflect.getMetadata(ROLES_KEY, UsersController.prototype.findById);
  const importRoles = Reflect.getMetadata(ROLES_KEY, ImportsController);
  const updateCompanyRoles = Reflect.getMetadata(ROLES_KEY, CompaniesController.prototype.update);
  const validateLocationRoles = Reflect.getMetadata(
    ROLES_KEY,
    CompaniesController.prototype.validateLocation,
  );
  const updateLocationRoles = Reflect.getMetadata(
    ROLES_KEY,
    CompaniesController.prototype.updateLocation,
  );

  assert.deepStrictEqual(createUserRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(deleteUserRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(listUserRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(getUserRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(importRoles, [UserRole.ADMIN]);
  assert.deepStrictEqual(updateCompanyRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(validateLocationRoles, [UserRole.ADMIN, UserRole.MANAGER]);
  assert.deepStrictEqual(updateLocationRoles, [UserRole.ADMIN]);
});
