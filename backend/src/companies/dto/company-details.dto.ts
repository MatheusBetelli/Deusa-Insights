import { IsEmail, IsOptional, IsString } from "class-validator";

export class CompanyDetailsDto {
  @IsOptional()
  @IsString()
  naturezaJuridica?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  descricaoCnae?: string;
}
