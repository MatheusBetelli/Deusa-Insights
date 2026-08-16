import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateCnaeDto {
  @IsString()
  @MaxLength(20)
  code!: string;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isTarget?: boolean;
}
