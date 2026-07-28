/**
 * Utilitários de Governança de Dados LGPD no Frontend
 */

export function maskCpfInRazaoSocial(razaoSocial: string | null | undefined): string {
  if (!razaoSocial) return "";

  let cleaned = razaoSocial.replace(
    /\b(\d{3})\.(\d{3})\.(\d{3})-(\d{2})\b/g,
    "***.***.$3-$4"
  );

  cleaned = cleaned.replace(/\b(\d{3})(\d{3})(\d{3})(\d{2})\b/g, (match, _p1, _p2, p3, p4) => {
    if (match.length === 11) {
      return `***.***.${p3}-${p4}`;
    }
    return match;
  });

  return cleaned;
}

export const LGPD_POLICY_INFO = {
  controller: "Deusa Alimentos S/A",
  dpoEmail: "privacidade@deusa.com.br",
  legalBasis: "Legítimo Interesse Comercial (Art. 7º, IX da Lei nº 13.709/2018)",
  retentionPeriod: "Enquanto durar a finalidade de relacionamento comercial B2B.",
  userRights: [
    "Acesso e confirmação da existência de tratamento de dados",
    "Correção de dados incompletos, inexatos ou desatualizados",
    "Solicitação de opt-out (bloqueio de prospecção comercial)",
    "Portabilidade e informação sobre compartilhamento de dados",
  ],
};
