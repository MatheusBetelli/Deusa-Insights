import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { DashboardQueryDto } from "../../dashboard/dto/dashboard-query.dto";

export class PipelineQueryDto extends DashboardQueryDto {
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
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  columnPageSize?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
