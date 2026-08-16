import { IsBoolean, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class UpdateCityDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  ibgeCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
