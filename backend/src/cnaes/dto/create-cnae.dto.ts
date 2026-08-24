import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";
import { transformOptionalBoolean } from "../../common/boolean-transform";

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
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  isTarget?: boolean;
}
