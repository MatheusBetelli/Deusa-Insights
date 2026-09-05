import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CommercialActionMutation, DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { CreateCommercialActionDto } from "./dto/create-commercial-action.dto";
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
  @CommercialActionMutation()
  create(
    @Param("id") leadId: string,
    @Body() dto: CreateLeadInteractionDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.leadInteractionsService.create(leadId, dto, request.user);
  }

  @Post("commercial-actions")
  @CommercialActionMutation()
  createCommercialAction(
    @Param("id") leadId: string,
    @Body() dto: CreateCommercialActionDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.leadInteractionsService.createCommercialAction(leadId, dto, request.user);
  }
}
