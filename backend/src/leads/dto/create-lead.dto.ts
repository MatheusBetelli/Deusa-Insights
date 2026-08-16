import { Type } from "class-transformer";
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { LeadStatus, PotentialLevel } from "@prisma/client";

export class CreateLeadDto {
  @IsString()
  @MaxLength(64)
  companyId!: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsEnum(PotentialLevel)
  potentialLevel?: PotentialLevel;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  assignedToId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  lastContactAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextActionAt?: Date;
}
