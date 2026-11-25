---
name: deusa-production-review
description: Revisar uma entrega do Deusa Insights para produção, distinguindo qualidade do código de evidências do ambiente e dos fluxos reais.
---

Leia `AGENTS.md`, `docs/architecture.md`, o diff e os comandos atuais do package.json. Não use resultados de auditorias antigas como aprovação atual.

Mapeie endpoints afetados até guardas, roles, escopo de carteira, DTOs e consultas Prisma. Confira respostas/logs sem segredos, CPF ou detalhes internos; cookies, expiração, CORS e configuração de produção conforme o fluxo alterado. Teste permissões e entradas inválidas usando as ferramentas existentes.

Preserve `AuthGuard`, `RolesGuard`, `DatasetFreezeGuard`, a fonte `ClientAccount.isCurrentClient` e a identidade de cada filial. Não amplie carteira por nome ou raiz de CNPJ. Antes de qualquer ação sobre dados, leia `dataset-freeze`; antes de consultas externas comerciais, leia `api-cost-commercial-scope`.

Execute verificações locais proporcionais: typecheck, lint, testes, deadcode, hygiene, build e check do artefato Node. Leia o código de `production:check` antes de executá-lo e evite imprimir configuração sensível. Não execute reset, seed, migração ou deploy por inferência de prontidão.

Reporte achados por severidade, arquivo, impacto e evidência. Separe checks locais de validação de ambiente: banco alvo, migrações, backup/restauração, HTTPS, sessão real, monitoramento e fluxos autenticados. Marque itens não verificados explicitamente. Build e testes com mocks não certificam produção nem conformidade de segurança.
