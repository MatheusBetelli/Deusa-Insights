import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { transformOptionalBoolean } from "../../common/boolean-transform";

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
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isTarget?: boolean;
}
