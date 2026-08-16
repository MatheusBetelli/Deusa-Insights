import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CitiesService } from "./cities.service";
import { CityQueryDto } from "./dto/city-query.dto";
import { CreateCityDto } from "./dto/create-city.dto";
import { UpdateCityDto } from "./dto/update-city.dto";

@UseGuards(AuthGuard)
@Controller("cities")
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  @Get()
  findAll(@Query() query: CityQueryDto) {
    return this.citiesService.findAll(query);
  }

  @Post()
  create(@Body() dto: CreateCityDto) {
    return this.citiesService.create(dto);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCityDto) {
    return this.citiesService.update(id, dto);
  }
}
