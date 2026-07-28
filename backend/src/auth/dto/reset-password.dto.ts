import { IsString, MinLength } from "class-validator";

export class ResetPasswordDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(6, { message: "A nova senha deve ter no mínimo 6 caracteres" })
  newPassword!: string;

  @IsString()
  @MinLength(6, { message: "A confirmação de senha deve ter no mínimo 6 caracteres" })
  confirmPassword!: string;
}
