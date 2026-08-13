import { Controller, Get, Post, Query } from "@nestjs/common";
import { MapOpportunitiesService } from "./map-opportunities.service";
import { IsOptional, IsString, IsNotEmpty } from "class-validator";

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

class DiscoverRegionDto {
  @IsNotEmpty({ message: "A cidade é obrigatória" })
  @IsString()
  cidade!: string;

  @IsNotEmpty({ message: "O estado (UF) é obrigatório" })
  @IsString()
  uf!: string;
}

@Controller("map")
export class MapOpportunitiesController {
  constructor(private readonly mapOpportunitiesService: MapOpportunitiesService) {}

  @Get("opportunities")
  findAll() {
    return this.mapOpportunitiesService.findAll();
  }

  /**
   * POST /map/discover-region?cidade=Bastos&uf=SP
   *
   * Descobre mercados/supermercados/mercearias na região via Google Places API
   * e cadastra automaticamente os que ainda não existem no banco.
   *
   * Retorna: { success, message, discovered, existing, total }
   */
  @Post("discover-region")
  discoverRegion(@Query() query: DiscoverRegionDto) {
    return this.mapOpportunitiesService.discoverRegion(query.cidade, query.uf);
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

