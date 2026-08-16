import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { LeadStatus } from "@prisma/client";

export class CreateLeadInteractionDto {
  @IsString()
  @MaxLength(64)
  userId!: string;

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsString()
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  newStatus?: LeadStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextActionAt?: Date;
}
