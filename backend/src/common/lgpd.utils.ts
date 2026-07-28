/**
 * Utilitários de Proteção de Dados Pessoais (LGPD - Lei nº 13.709/2018)
 * Deusa Analytics — Sistema de Governança de Dados
 */

/**
 * Mascara CPFs incorporados na Razão Social de MEIs / Empresários Individuais.
 * Exemplo: "12.345.678 BRUNO SILVA 12345678900" -> "12.345.678 BRUNO SILVA ***.***.789-00"
 */
export function maskCpfInRazaoSocial(razaoSocial: string | null | undefined): string {
  if (!razaoSocial) return "";

  // Mascara formato de CPF com pontuação: 123.456.789-00
  let cleaned = razaoSocial.replace(
    /\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g,
    "***.***.$3-$4"
  );

  // Mascara 11 dígitos numéricos isolados no final da Razão Social (típico de MEIs na Receita Federal)
  cleaned = cleaned.replace(/\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g, (match, p1, p2, p3, p4) => {
    // Se for 14 dígitos (CNPJ), mantém. Se for 11 dígitos (CPF), mascara os primeiros 6 dígitos
    if (match.length === 11) {
      return `***.***.${p3}-${p4}`;
    }
    return match;
  });

  return cleaned;
}

/**
 * Mascara e-mails para logs de auditoria sem vazar dados pessoais completos.
 * Exemplo: "joao.silva@deusa.com.br" -> "j***a@deusa.com.br"
 */
export function maskEmailForLogs(email: string | null | undefined): string {
  if (!email) return "[anonimo]";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const [name, domain] = parts;
  if (name.length <= 2) return `${name[0]}*@${domain}`;
  return `${name[0]}***${name[name.length - 1]}@${domain}`;
}

/**
 * Sanitiza dados de empresa para envio ao frontend respeitando os princípios da LGPD.
 */
export function sanitizeCompanyForLgpd<T extends { razaoSocial?: string; [key: string]: any }>(company: T): T {
  if (!company) return company;
  return {
    ...company,
    ...(company.razaoSocial ? { razaoSocial: maskCpfInRazaoSocial(company.razaoSocial) } : {}),
  };
}
