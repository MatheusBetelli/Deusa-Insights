import { Transform, Type } from "class-transformer";
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

function trimValue({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class CommercialActivitiesQueryDto {
  @IsOptional()
  @IsIn(["activities", "followups"])
  view?: "activities" | "followups";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(160)
  company?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @Transform(trimValue)
  @IsString()
  @MaxLength(64)
  responsibleId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
