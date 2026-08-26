import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsString, Matches, MaxLength, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";
import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from "../../auth/password-policy";

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
