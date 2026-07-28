import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { CitiesModule } from "./cities/cities.module";
import { CnaesModule } from "./cnaes/cnaes.module";
import { CompaniesModule } from "./companies/companies.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { ImportsModule } from "./imports/imports.module";
import { LeadInteractionsModule } from "./lead-interactions/lead-interactions.module";
import { LeadsModule } from "./leads/leads.module";
import { MapOpportunitiesModule } from "./map-opportunities/map-opportunities.module";
import { PipelineModule } from "./pipeline/pipeline.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { ClassificationModule } from "./classification/classification.module";

import { HealthModule } from "./health/health.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CitiesModule,
    CnaesModule,
    CompaniesModule,
    LeadsModule,
    LeadInteractionsModule,
    ImportsModule,
    DashboardModule,
    MapOpportunitiesModule,
    PipelineModule,
    ClassificationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
