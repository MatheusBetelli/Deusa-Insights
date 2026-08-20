/**
 * Entrada legada deliberadamente desativada.
 *
 * O script anterior criava empresas, CNPJs e cidades sintéticos, além de fazer
 * associação aproximada por nome. A importação suportada fica no endpoint
 * administrativo POST /imports/excel-clients, que aplica validação e transação.
 */

throw new Error(
  "Script legado desativado por risco de corrupção de dados. Use POST /imports/excel-clients.",
);
