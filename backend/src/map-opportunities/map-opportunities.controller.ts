import { Controller, Get, Query } from "@nestjs/common";
import { MapOpportunitiesService } from "./map-opportunities.service";
import { IsOptional, IsString } from "class-validator";

// DTO simplificado — somente filtros regionais (sem validação individual)
class HeatmapQueryDto {
  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  cnae?: string;
}

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
