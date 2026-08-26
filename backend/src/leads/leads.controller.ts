import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { DatasetFreezeGuard } from "../common/dataset-freeze.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { UserRole } from "@prisma/client";
import { CreateLeadDto } from "./dto/create-lead.dto";
import { LeadQueryDto } from "./dto/lead-query.dto";
import { UpdateLeadDto } from "./dto/update-lead.dto";
import { LeadsService } from "./leads.service";

@UseGuards(AuthGuard, RolesGuard, DatasetFreezeGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  findAll(@Query() query: LeadQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.findAll(query, request.user);
  }

  @Get("export.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header("Content-Disposition", 'attachment; filename="leads-b2b.csv"')
  @Header("Cache-Control", "no-store")
  exportCsv(@Query() query: LeadQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.exportCsv(query, request.user);
  }

  @Post("auto-assign")
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  autoAssign() {
    return this.leadsService.autoAssignTerritory();
  }

  /**
   * Consulta detalhada de lead por ID.
   * Nota de Arquitetura: A inteligência comercial e o mapa de oportunidades trabalham em modelo de
   * carteira e catálogo de oportunidades compartilhados entre a equipe comercial.
   */
  @Get(":id")
  findById(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.findById(id, request.user);
  }

  @Post()
  create(@Body() dto: CreateLeadDto, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.create(dto, request.user);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateLeadDto,
    @Req() request: AuthenticatedHttpRequest,
  ) {
    return this.leadsService.update(id, dto, request.user);
  }

  @Post(":id/convert")
  convert(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.convert(id, request.user);
  }

  @Post(":id/discard")
  discard(@Param("id") id: string, @Req() request: AuthenticatedHttpRequest) {
    return this.leadsService.discard(id, request.user);
  }
}
