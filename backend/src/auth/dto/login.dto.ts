import { Transform } from "class-transformer";
import { IsBoolean, IsEmail, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { transformOptionalBoolean } from "../../common/boolean-transform";

export class LoginDto {
  @Transform(({ value }) => (typeof value === "string" ? value.trim().toLowerCase() : value))
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @Transform(transformOptionalBoolean)
  @IsBoolean()
  rememberMe?: boolean;
}
