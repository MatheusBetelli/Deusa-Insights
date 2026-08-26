import { IsString, Matches, MaxLength, MinLength } from "class-validator";
import { STRONG_PASSWORD_MESSAGE, STRONG_PASSWORD_PATTERN } from "../password-policy";

export class ResetPasswordDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  @IsString()
  @MinLength(12, { message: "A nova senha deve ter no mínimo 12 caracteres" })
  @MaxLength(128, { message: "A nova senha deve ter no máximo 128 caracteres" })
  @Matches(STRONG_PASSWORD_PATTERN, { message: STRONG_PASSWORD_MESSAGE })
  newPassword!: string;

  @IsString()
  @MinLength(12, { message: "A confirmação de senha deve ter no mínimo 12 caracteres" })
  @MaxLength(128, { message: "A confirmação de senha deve ter no máximo 128 caracteres" })
  confirmPassword!: string;
}
