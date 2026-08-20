import { IsISO8601, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";

export class ValidateLocationDto {
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsNotEmpty()
  @IsString()
  @IsIn([
    "confirmado",
    "provavel",
    "nao_encontrado",
    "endereco_invalido",
    "resultado_incompativel",
    "fechado",
    "rejeitado",
    "revisao_manual",
  ])
  statusValidacao!: string; // "confirmado" | "provavel" | "nao_encontrado" | "endereco_invalido" | "resultado_incompativel" | "fechado" | "rejeitado" | "revisao_manual"

  @IsOptional()
  @IsString()
  @IsIn([
    "validacao_manual_com_evidencia",
    "google_places",
    "google_maps",
    "site_oficial",
    "rede_social_oficial",
    "outro_diretorio_comercial",
    "validacao_em_campo",
    "coordenada_manual",
    "sem_coordenada",
  ])
  origemCoordenada?: string; // "google_places" | "google_maps" | "site_oficial" | "rede_social_oficial" | "outro_diretorio_comercial" | "validacao_em_campo" | "coordenada_manual" | "sem_coordenada"

  @IsOptional()
  @IsString()
  @MaxLength(255)
  enderecoVerificado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacaoValidacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fonteConsultada?: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  urlEvidencia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  placeId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeEncontrado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  enderecoEncontrado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefoneEncontrado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoriaEncontrada?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  situacaoAparente?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  distanciaAproximadaMeters?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justificativaDecisao?: string;

  // ─── Validação em Campo ───────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nomeResponsavelVisita?: string;

  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true })
  dataVisita?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  evidenciaVisita?: string;
}
