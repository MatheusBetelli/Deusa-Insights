import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsOptional, IsString, Matches, MaxLength } from "class-validator";
import { AuthGuard } from "../auth/auth.guard";
import { MapOpportunitiesService } from "./map-opportunities.service";

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

@UseGuards(AuthGuard)
@Controller("map")
export class MapOpportunitiesController {
  constructor(private readonly mapOpportunitiesService: MapOpportunitiesService) {}

  @Get("opportunities")
  findAll() {
    return this.mapOpportunitiesService.findAll();
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
