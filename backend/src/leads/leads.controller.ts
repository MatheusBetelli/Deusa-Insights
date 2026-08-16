import { Body, Controller, Get, Header, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { LeadsService } from "./leads.service";

@UseGuards(AuthGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadQueryDto) {
    return this.leadsService.findAll(query);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="leads-b2b.csv"')
  exportCsv(@Query() query: LeadQueryDto) {
    return this.leadsService.exportCsv(query);
  }

  @Post("auto-assign")
  autoAssign() {
    return this.leadsService.autoAssignTerritory();
  }

  @Get(":id")
  findById(@Param("id") id: string) {
    return this.leadsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateLeadDto) {
    return this.leadsService.update(id, dto);
  }

  @Post(":id/convert")
  convert(@Param("id") id: string) {
    return this.leadsService.convert(id);
  }

  @Post(":id/discard")
  discard(@Param("id") id: string) {
    return this.leadsService.discard(id);
  }
}
