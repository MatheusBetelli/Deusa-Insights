import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsString, MaxLength, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateInvitationDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
