import { IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

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
  statusValidacao!: string; // "confirmado" | "provavel" | "nao_encontrado" | "endereco_invalido" | "resultado_incompativel" | "fechado" | "rejeitado" | "revisao_manual"

  @IsOptional()
  @IsString()
  origemCoordenada?: string; // "google_places" | "google_maps" | "site_oficial" | "rede_social_oficial" | "outro_diretorio_comercial" | "validacao_em_campo" | "coordenada_manual" | "sem_coordenada"

  @IsOptional()
  @IsString()
  enderecoVerificado?: string;

  @IsOptional()
  @IsString()
  observacaoValidacao?: string;

  @IsOptional()
  @IsString()
  fonteConsultada?: string;

  @IsOptional()
  @IsString()
  urlEvidencia?: string;

  @IsOptional()
  @IsString()
  placeId?: string;

  @IsOptional()
  @IsString()
  nomeEncontrado?: string;

  @IsOptional()
  @IsString()
  enderecoEncontrado?: string;

  @IsOptional()
  @IsString()
  telefoneEncontrado?: string;

  @IsOptional()
  @IsString()
  categoriaEncontrada?: string;

  @IsOptional()
  @IsString()
  situacaoAparente?: string;

  @IsOptional()
  @IsNumber()
  distanciaAproximadaMeters?: number;

  @IsOptional()
  @IsString()
  justificativaDecisao?: string;

  // ─── Validação em Campo ───────────────────────────────────────────────────
  @IsOptional()
  @IsString()
  nomeResponsavelVisita?: string;

  @IsOptional()
  @IsString()
  dataVisita?: string;

  @IsOptional()
  @IsString()
  evidenciaVisita?: string;
}
