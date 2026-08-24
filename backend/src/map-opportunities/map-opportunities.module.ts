import { Module } from "@nestjs/common";
import { MapOpportunitiesController } from "./map-opportunities.controller";
import { MapOpportunitiesService } from "./map-opportunities.service";

@Module({
  controllers: [MapOpportunitiesController],
  providers: [MapOpportunitiesService],
})
export class MapOpportunitiesModule {}
