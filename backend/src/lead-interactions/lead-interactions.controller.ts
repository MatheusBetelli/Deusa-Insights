import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { CreateLeadInteractionDto } from "./dto/create-lead-interaction.dto";
import { LeadInteractionsService } from "./lead-interactions.service";

@UseGuards(AuthGuard, DatasetFreezeGuard)
@Controller("leads/:id/interactions")
export class LeadInteractionsController {
  constructor(private readonly leadInteractionsService: LeadInteractionsService) {}

  @Get()
  findByLead(@Param("id") leadId: string, @Req() request: AuthenticatedHttpRequest) {
    return this.leadInteractionsService.findByLead(leadId, request.user);
  }

  @Post()
  create(
    @Param("id") leadId: string,
    @Body() dto: CreateLeadInteractionDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.leadInteractionsService.create(leadId, dto, request.user);
  }
}
