export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function normalizeCnpj(value: string) {
  return onlyDigits(value);
}

export function formatCnpj(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
