import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CnaesService } from "./cnaes.service";
import { CnaeQueryDto } from "./dto/cnae-query.dto";
import { CreateCnaeDto } from "./dto/create-cnae.dto";
import { UpdateCnaeDto } from "./dto/update-cnae.dto";

@Controller("cnaes")
export class CnaesController {
  constructor(private readonly cnaesService: CnaesService) {}

  @Get()
  findAll(@Query() query: CnaeQueryDto) {
    return this.cnaesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateCnaeDto) {
    return this.cnaesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCnaeDto) {
    return this.cnaesService.update(id, dto);
  }
}
