import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CreateLeadInteractionDto } from "./dto/create-lead-interaction.dto";
import { LeadInteractionsService } from "./lead-interactions.service";

@UseGuards(AuthGuard)
@Controller("leads/:id/interactions")
export class LeadInteractionsController {
  constructor(private readonly leadInteractionsService: LeadInteractionsService) {}

  @Get()
  findByLead(@Param("id") leadId: string) {
    return this.leadInteractionsService.findByLead(leadId);
  }

  @Post()
  create(@Param("id") leadId: string, @Body() dto: CreateLeadInteractionDto) {
    return this.leadInteractionsService.create(leadId, dto);
  }
}
