import { Type } from "class-transformer";
import { IsArray, IsDate, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from "class-validator";

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  razaoSocial?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  nomeFantasia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  situacaoCadastral?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  porte?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  matrizFilial?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dataAbertura?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnaePrincipal?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bairro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  cep?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complemento?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  source?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(20, { each: true })
  cnaes?: string[];
}
