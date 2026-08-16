import { Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { Transform } from "class-transformer";
import { IsOptional, IsString, IsNotEmpty, Length, Matches, MaxLength } from "class-validator";
import { Throttle } from "@nestjs/throttler";
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

class DiscoverRegionDto {
  @IsNotEmpty({ message: "A cidade é obrigatória" })
  @IsString()
  @MaxLength(120)
  cidade!: string;

  @IsNotEmpty({ message: "O estado (UF) é obrigatório" })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/, { message: "uf deve ser uma UF válida" })
  uf!: string;
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
   * POST /map/discover-region?cidade=Bastos&uf=SP
   *
   * Descobre mercados/supermercados/mercearias na região via Google Places API
   * e cadastra automaticamente os que ainda não existem no banco.
   *
   * Retorna: { success, message, discovered, existing, total }
   */
  @Post("discover-region")
  @Throttle({ default: { ttl: 60000, limit: 6 } })
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
