import { Type } from "class-transformer";
import { IsDate, IsEnum, IsOptional, IsString } from "class-validator";
import { LeadStatus } from "@prisma/client";

export class CreateLeadInteractionDto {
  @IsString()
  userId!: string;

  @IsString()
  type!: string;

  @IsString()
  description!: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  newStatus?: LeadStatus;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextActionAt?: Date;
}
