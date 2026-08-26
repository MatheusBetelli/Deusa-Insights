import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from "../password-policy";

export class ChangePasswordDto {
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  newPassword!: string;

  @IsString()
  @MaxLength(128)
  confirmPassword!: string;
}
