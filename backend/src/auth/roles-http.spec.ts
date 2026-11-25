import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AuthGuard } from "./auth.guard";
import { RolesGuard } from "./roles.guard";
import { DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { AuditLoggerService } from "../common/audit-logger.service";
import { PrismaService } from "../prisma/prisma.service";
import { UsersController } from "../users/users.controller";
import { ImportsController } from "../imports/imports.controller";
import { LeadsController } from "../leads/leads.controller";
import { DashboardController } from "../dashboard/dashboard.controller";
import { MapOpportunitiesController } from "../map-opportunities/map-opportunities.controller";
import { CitiesController } from "../cities/cities.controller";
import { CnaesController } from "../cnaes/cnaes.controller";
import { NotificationsController } from "../notifications/notifications.controller";
import { PipelineController } from "../pipeline/pipeline.controller";
import { CompaniesController } from "../companies/companies.controller";
import { CommercialActivitiesController } from "../lead-interactions/commercial-activities.controller";

test("HTTP integra AuthGuard, RolesGuard e congelamento nas três sessões simuladas", async () => {
  const controllers = [
    UsersController,
    ImportsController,
    LeadsController,
    DashboardController,
    MapOpportunitiesController,
    CitiesController,
    CnaesController,
    NotificationsController,
    PipelineController,
    CompaniesController,
    CommercialActivitiesController,
  ];
  const version = new Date("2026-01-01");
  let invoked = 0;
  const fixtures = new Map<unknown, unknown>([
    [UsersController, []],
    [ImportsController, []],
    [LeadsController, { items: [], total: 0, page: 1, pageSize: 10 }],
    [DashboardController, { portfolio: { activeClients: 0 }, potentialClients: 0 }],
    [MapOpportunitiesController, []],
    [CitiesController, []],
    [CnaesController, []],
    [NotificationsController, []],
    [PipelineController, { total: 0, stages: {} }],
    [CompaniesController, []],
    [CommercialActivitiesController, { items: [], total: 0 }],
  ]);
  const serviceProviders = controllers.map((controller) => ({
    provide: Reflect.getMetadata("design:paramtypes", controller)[0],
    useValue: new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === "then" || String(key).startsWith("on")) return undefined;
          return () => {
            invoked++;
            return fixtures.get(controller);
          };
        },
      },
    ),
  }));
  @Module({
    controllers,
    providers: [
      ...serviceProviders,
      Reflector,
      AuthGuard,
      RolesGuard,
      DatasetFreezeGuard,
      {
        provide: ConfigService,
        useValue: { get: (key: string) => (key === "ENABLE_LEAD_MUTATIONS" ? "false" : undefined) },
      },
      { provide: AuditLoggerService, useValue: { logEvent: () => undefined } },
      {
        provide: JwtService,
        useValue: {
          verifyAsync: async (role: string) => {
            assert.ok(["ADMIN", "MANAGER", "SALES"].includes(role));
            return { sub: role, type: "access", ver: version.getTime() };
          },
        },
      },
      {
        provide: PrismaService,
        useValue: {
          user: {
            findUnique: async ({ where }: { where: { id: string } }) => ({
              id: where.id,
              role: where.id,
              status: "ACTIVE",
              updatedAt: version,
            }),
          },
        },
      },
    ],
  })
  class HttpFixtureModule {}
  const app = await NestFactory.create(HttpFixtureModule, { logger: false });
  try {
    await app.listen(0, "127.0.0.1");
    const url = await app.getUrl();
    for (const role of ["ADMIN", "MANAGER", "SALES"]) {
      for (const [path, fixture] of [
        ["/leads", fixtures.get(LeadsController)],
        ["/dashboard/summary", fixtures.get(DashboardController)],
        ["/map/opportunities", []],
        ["/cities", []],
        ["/cnaes", []],
        ["/notifications", []],
        ["/pipeline", fixtures.get(PipelineController)],
        ["/companies", []],
        ["/commercial-activities", fixtures.get(CommercialActivitiesController)],
        ["/users", []],
        ["/imports", []],
      ] as const) {
        const expected =
          (path === "/users" && role === "SALES") || (path === "/imports" && role !== "ADMIN")
            ? 403
            : 200;
        const response = await fetch(url + path, { headers: { Authorization: "Bearer " + role } });
        assert.equal(response.status, expected, role + path);
        if (expected === 200) assert.deepEqual(await response.json(), fixture);
      }
      const before = invoked;
      const response = await fetch(url + "/imports/excel-clients", {
        method: "POST",
        headers: { Authorization: "Bearer " + role },
      });
      assert.equal(response.status, 403);
      assert.equal(invoked, before, "Guardas devem impedir qualquer serviço de escrita");
    }
    assert.equal((await fetch(url + "/leads")).status, 401);
  } finally {
    await app.close();
  }
});
