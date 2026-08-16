import { IsEmail, IsOptional, IsString, MaxLength } from "class-validator";

export class CompanyDetailsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  naturezaJuridica?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  telefone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descricaoCnae?: string;
}
