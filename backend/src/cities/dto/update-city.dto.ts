import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { transformOptionalBoolean } from "../../common/boolean-transform";

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
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}
