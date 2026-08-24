import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";

const dashboardPeriods = [
  "selected_month",
  "current_month",
  "last_3_months",
  "last_6_months",
  "last_12_months",
] as const;

export type DashboardPeriod = (typeof dashboardPeriods)[number];

export class DashboardQueryDto {
  @IsOptional()
  @IsIn(dashboardPeriods)
  period?: DashboardPeriod;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2020)
  @Max(2100)
  year?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2)
  uf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cnae?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;
}
