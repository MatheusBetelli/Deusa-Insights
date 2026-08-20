/**
 * Entrada legada deliberadamente desativada.
 *
 * O script anterior gravava UUIDs aleatórios como se viessem do provedor de
 * autenticação e alterava relacionamentos reais. Uma migração de identidade
 * precisa receber UUIDs emitidos pelo provedor e ter plano de rollback próprio.
 */

throw new Error(
  "Script inseguro desativado. Use uma migração versionada com UUIDs reais do provedor de autenticação.",
);
