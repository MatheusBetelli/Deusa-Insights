import { IsBoolean, IsOptional, IsString, Length, MaxLength } from "class-validator";

export class CreateCityDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @Length(2, 2)
  uf!: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  ibgeCode?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
