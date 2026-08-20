import { IsEmail, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class UpdateCommercialProfileDto {
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
  @MaxLength(160)
  logradouro?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  numero?: string;

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
  @MaxLength(120)
  cidade?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
