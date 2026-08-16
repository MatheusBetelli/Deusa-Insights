import "reflect-metadata";
import assert from "node:assert";
import { test } from "node:test";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { AuthGuard } from "./auth.guard";
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
