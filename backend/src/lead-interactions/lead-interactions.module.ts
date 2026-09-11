import { Module } from "@nestjs/common";
import { DashboardModule } from "../dashboard/dashboard.module";
import { MapOpportunitiesModule } from "../map-opportunities/map-opportunities.module";
import { CommercialActivitiesController } from "./commercial-activities.controller";
import { LeadInteractionsController } from "./lead-interactions.controller";
import { LeadInteractionsService } from "./lead-interactions.service";

@Module({
  imports: [DashboardModule, MapOpportunitiesModule],
  controllers: [LeadInteractionsController, CommercialActivitiesController],
  providers: [LeadInteractionsService],
})
export class LeadInteractionsModule {}
