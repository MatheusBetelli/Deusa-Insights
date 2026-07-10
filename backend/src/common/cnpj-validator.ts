/**
 * Valida um CNPJ completo, incluindo o cálculo dos dígitos verificadores (módulo 11).
 * Aceita CNPJ com ou sem formatação (pontos, barras, hifens).
 */
export function isValidCnpj(cnpj: string): boolean {
  const digits = cnpj.replace(/\D/g, "");

  if (digits.length !== 14) return false;

  // Rejeita CNPJs com todos os dígitos iguais (ex: 00000000000000)
  if (/^(\d)\1+$/.test(digits)) return false;

  const calcDigit = (base: string, weights: number[]): number => {
    let sum = 0;
    for (let i = 0; i < weights.length; i++) {
      sum += parseInt(base[i], 10) * weights[i];
    }
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 12), weights1);
  if (d1 !== parseInt(digits[12], 10)) return false;

  const d2 = calcDigit(digits.slice(0, 13), weights2);
  if (d2 !== parseInt(digits[13], 10)) return false;

  return true;
}
