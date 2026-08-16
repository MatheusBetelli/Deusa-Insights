import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateCnaeDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsBoolean()
  isTarget?: boolean;
}
