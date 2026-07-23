import { IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";
import { Transform, Type } from "class-transformer";

export class MapQueryDto {
  @IsOptional()
  @IsString()
  cnae?: string;

  @IsOptional()
  @IsString()
  municipio?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  statusValidacao?: string;

  @IsOptional()
  @IsString()
  nivelOportunidade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  confiancaMinima?: number;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  possuiCoordenada?: boolean;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
