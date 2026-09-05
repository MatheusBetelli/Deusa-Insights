import { Transform } from "class-transformer";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export enum CommercialActionType {
  VISITA = "VISITA",
  LIGACAO = "LIGACAO",
  WHATSAPP = "WHATSAPP",
  EMAIL = "EMAIL",
  REUNIAO = "REUNIAO",
  RETORNO = "RETORNO",
  SEM_INTERESSE = "SEM_INTERESSE",
  OUTRO = "OUTRO",
}

export class CreateCommercialActionDto {
  @IsEnum(CommercialActionType)
  type!: CommercialActionType;

  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MaxLength(2000)
  description?: string;
}
