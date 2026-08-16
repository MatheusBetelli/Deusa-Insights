import { IsBoolean, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { Transform, Type } from "class-transformer";

export class MapQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnae?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  municipio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  statusValidacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nivelOportunidade?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  confiancaMinima?: number;

  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  possuiCoordenada?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  cnpj?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
