export const STRONG_PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;

export const STRONG_PASSWORD_MESSAGE =
  "A senha deve ter pelo menos 12 caracteres, com maiúscula, minúscula, número e símbolo";
