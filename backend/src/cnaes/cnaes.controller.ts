import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/roles.decorator";
import { RolesGuard } from "../auth/roles.guard";
import { UserRole } from "@prisma/client";
import { CnaesService } from "./cnaes.service";
import { CnaeQueryDto } from "./dto/cnae-query.dto";
import { CreateCnaeDto } from "./dto/create-cnae.dto";
import { UpdateCnaeDto } from "./dto/update-cnae.dto";

@UseGuards(AuthGuard, RolesGuard)
@Controller("cnaes")
export class CnaesController {
  constructor(private readonly cnaesService: CnaesService) {}

  @Get()
  findAll(@Query() query: CnaeQueryDto) {
    return this.cnaesService.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateCnaeDto) {
    return this.cnaesService.create(dto);
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateCnaeDto) {
    return this.cnaesService.update(id, dto);
  }
}
