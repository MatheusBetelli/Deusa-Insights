import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { CommercialActivitiesQueryDto } from "./dto/commercial-activities-query.dto";
import { LeadInteractionsService } from "./lead-interactions.service";

@UseGuards(AuthGuard, DatasetFreezeGuard)
@Controller("commercial-activities")
export class CommercialActivitiesController {
  constructor(private readonly leadInteractionsService: LeadInteractionsService) {}

  @Get()
  findAll(@Query() query: CommercialActivitiesQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.leadInteractionsService.findCommercialActivities(query, request.user);
  }
}
