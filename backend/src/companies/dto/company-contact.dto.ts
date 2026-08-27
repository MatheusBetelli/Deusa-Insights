import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ContactSource, ContactType } from "@prisma/client";

export class CreateCompanyContactDto {
  @IsEnum(ContactType)
  type!: ContactType;

  @IsString()
  @MaxLength(255)
  value!: string;

  @IsOptional()
  @IsEnum(ContactSource)
  source?: ContactSource;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateCompanyContactDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  value?: string;

  @IsOptional()
  @IsEnum(ContactSource)
  source?: ContactSource;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
