import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class VerifyGoogleBatchQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @IsOptional()
  dryRun?: any;
}
