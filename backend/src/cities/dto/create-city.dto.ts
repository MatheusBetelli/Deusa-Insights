import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, Length, MaxLength } from "class-validator";
import { transformOptionalBoolean } from "../../common/boolean-transform";

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
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isActive?: boolean;
}
