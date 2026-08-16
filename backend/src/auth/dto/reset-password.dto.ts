import { IsString, MaxLength, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  @MaxLength(4096)
  token!: string;

  @IsString()
  @MinLength(8, { message: "A nova senha deve ter no mínimo 8 caracteres" })
  @MaxLength(128, { message: "A nova senha deve ter no máximo 128 caracteres" })
  newPassword!: string;

  @IsString()
  @MinLength(8, { message: "A confirmação de senha deve ter no mínimo 8 caracteres" })
  @MaxLength(128, { message: "A confirmação de senha deve ter no máximo 128 caracteres" })
  confirmPassword!: string;
}
