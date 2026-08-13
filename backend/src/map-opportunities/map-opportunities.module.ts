import { Module } from "@nestjs/common";
import { MapOpportunitiesController } from "./map-opportunities.controller";
import { MapOpportunitiesService } from "./map-opportunities.service";
import { GeocodingService } from "../common/geocoding.service";

@Module({
  controllers: [MapOpportunitiesController],
  providers: [MapOpportunitiesService, GeocodingService],
})
export class MapOpportunitiesModule {}
