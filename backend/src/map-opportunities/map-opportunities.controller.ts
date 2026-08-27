import { Controller, Get, Query, Req, UseGuards } from "@nestjs/common";
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { AuthenticatedHttpRequest } from "../common/auditable-http.types";
import { MapOpportunitiesService } from "./map-opportunities.service";
import { PotentialLevel } from "@prisma/client";

class HeatmapQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^(Todos|[A-Za-z]{2})$/, { message: "estado deve ser uma UF válida" })
  estado?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(120)
  municipio?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value !== "string" || value === "Todos") return value;
    return value.replace(/\D/g, "");
  })
  @Matches(/^(Todos|\d{7})$/, { message: "cnae deve conter 7 dígitos" })
  cnae?: string;
}

class MapOpportunityQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^(Todos|[A-Za-z]{2})$/, { message: "uf deve ser uma UF válida" })
  uf?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(64)
  companyId?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @MaxLength(20)
  cnae?: string;

  @IsOptional()
  @IsEnum(PotentialLevel)
  potentialLevel?: PotentialLevel;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @Matches(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/, {
    message: "bbox deve usar west,south,east,north",
  })
  bbox?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (typeof value === "boolean") return value;
    return String(value).trim().toLowerCase() === "true";
  })
  @IsBoolean()
  client?: boolean;
}

@UseGuards(AuthGuard)
@Controller("map")
export class MapOpportunitiesController {
  constructor(private readonly mapOpportunitiesService: MapOpportunitiesService) {}

  @Get("opportunities")
  findAll(@Query() query: MapOpportunityQueryDto, @Req() request: AuthenticatedHttpRequest) {
    return this.mapOpportunitiesService.findAll(request.user, query);
  }

  /**
   * GET /map/heatmap
   *
   * Retorna os dados regionais do mapa de calor.
   * Agrupa empresas ATIVAS por município com deduplicação de CNPJ.
   * Não depende de validação manual ou coordenadas individuais.
   *
   * Filtros opcionais:
   *   - estado: UF (ex: "SP")
   *   - municipio: nome do município (ex: "Tupã")
   *   - cnae: código CNAE (ex: "4712100")
   *
   * Resposta: array de { municipio, uf, latitude, longitude, quantidadeEmpresas, intensidade }
   */
  @Get("heatmap")
  getHeatmap(@Query() query: HeatmapQueryDto) {
    return this.mapOpportunitiesService.getHeatmapData({
      estado: query.estado,
      municipio: query.municipio,
      cnae: query.cnae,
    });
  }
}
