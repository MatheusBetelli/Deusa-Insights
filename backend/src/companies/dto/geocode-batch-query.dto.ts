import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Matches, Max, Min } from "class-validator";

export class GeocodeBatchQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.replace(/\D/g, "") : value))
  @Matches(/^\d{7}$/, { message: "cnaeCode deve conter 7 dígitos" })
  cnaeCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Transform(({ obj, key }) => {
    const value = (obj as Record<string, unknown>)[key];
    if (value === undefined || value === null || value === "") return undefined;
    if (value === true || value === "true") return true;
    if (value === false || value === "false") return false;
    return value;
  })
  @IsBoolean()
  force?: boolean;
}
