# Diagnóstico técnico e resumo executivo

**Data da auditoria:** 19/11/2026

**Snapshot:** branch `main`, commit `e42998e` (11/09/2026), árvore limpa antes da criação destes documentos.
**Escopo:** leitura do código e da configuração, testes unitários locais, typecheck e lint. Não foram lidos arquivos `.env`, consultados bancos, executadas importações, chamadas APIs pagas, migrations, seeds ou deploys.

## Resumo executivo

| Tema | Diagnóstico comprovado |
|---|---|
| Estado atual | Existe uma aplicação interna Deusa Analytics com frontend React/TanStack, API NestJS, Prisma/PostgreSQL, autenticação, painel, gestão de leads, carteira, funil e mapa. O funcionamento contra banco e infraestrutura atuais não foi verificado. |
| Conquistas | Estrutura modular, contratos tipados, filtros de acesso no servidor, controles de sessão, importação de carteira e cadastro público, fluxo de validação manual de localização, migrações e testes unitários. Nesta auditoria, 158 testes backend e 25 frontend passaram; typecheck e lint passaram nos dois pacotes. |
| Limitações | A descoberta lê um CSV local, não consulta uma API pública em tempo real. A origem e a data efetiva do CSV não têm prova incorporada ao registro. Nomes e coordenadas podem ser substitutos/estimativas. Parte da carteira pode ficar sem vínculo por CNPJ ou código divergente. |
| Risco para o negócio | O rótulo “não cliente” significa ausência de uma conta ativa vinculada ao registro por relação no banco; não prova que a loja não pertença à carteira. A posição no mapa pode ser uma aproximação municipal, não o endereço da loja. |
| Deusa Direto | Não encontrei uma aplicação, módulo ou fluxo de pedidos Deusa Direto neste repositório. Há apenas referências a uma URL de loja externa nos componentes do Analytics; isso não comprova integração nem implementação do canal. |
| Produção | **Classificação 3 — adequado somente para demonstração ou homologação.** Os testes são unitários; não há prova de banco, login, fluxo comercial, build de produção, disponibilidade de serviços ou deploy atual. |
| Próxima ação | A Deusa deve aprovar a fonte oficial da carteira, a chave de correspondência por filial e uma amostra controlada para validação comercial. Em paralelo, preparar ambiente de homologação isolado com dados autorizados e procedência documentada. |

## O que foi verificado e o que não foi

- O estado inicial do Git era limpo em `main`, commit `e42998e`. As alterações desta auditoria estão limitadas aos seis documentos desta pasta.
- Node instalado: `v22.12.0`; npm: `10.9.0`. O projeto exige Node `^22.13.0` ou `>=24.0.0`; portanto, o Node local está abaixo do requisito declarado em [package.json](../../package.json), linhas 6–9.
- O diretório local contém CSVs de trabalho, mas eles são ignorados pelo Git em [.gitignore](../../.gitignore), linha 54. Os registros não foram lidos. A presença local não comprova que o mesmo arquivo esteja no CI, na imagem de produção ou atualizado.
- As sondagens HTTP somente de leitura em `127.0.0.1:3001/health/live`, `127.0.0.1:5173/login` e `127.0.0.1:8080/login` retornaram código `000` (sem resposta). A inspeção de portas via `ss` foi bloqueada pelo ambiente. Não havia evidência de aplicação local ativa.
- Os arquivos `.env` locais não foram lidos nem usados. Não se conhece, nesta auditoria, o destino de `DATABASE_URL`, as credenciais configuradas ou a disponibilidade do banco.
- Não foram consultados GCP, Supabase, Resend, Google Maps Platform, GitHub Actions ou dados comerciais em produção. A causa pela qual a hospedagem deixou de estar disponível é **não verificada**.

## Arquitetura atual

```text
React 19 + TanStack Start/Router + Vite
        │ REST JSON; produção usa /api no mesmo host
        ▼
Frontend SSR Node e proxy de API
        │ encaminha para BACKEND_ORIGIN
        ▼
NestJS 11 + autenticação JWT em cookie + RBAC
        │ Prisma ORM 6.12
        ▼
PostgreSQL local (Docker Compose) ou PostgreSQL gerenciado
```

O backend é dividido em módulos como autenticação, usuários, empresas, carteira, leads, importações, dashboard, mapa, pipeline e atividades em [app.module.ts](../../backend/src/app.module.ts), linhas 25–61. O cliente frontend chama a API por serviços em [api.ts](../../frontend/src/services/api.ts), linhas 14–51 e 69–117. O servidor SSR pode encaminhar `/api/*` para uma origem fixa de backend em [server.ts](../../frontend/src/server.ts), linhas 18–87. O banco é PostgreSQL acessado pelo Prisma, conforme [schema.prisma](../../backend/prisma/schema.prisma), linhas 1–10.

O modelo separa `Company`, `ClientAccount`, `Lead`, `LeadInteraction`, `ImportJob`, contatos e auditoria de localização. Há também estruturas legadas de usuário e `Profile`, com campos legados de atribuição ainda presentes no schema; veja [schema.prisma](../../backend/prisma/schema.prisma), linhas 62–120 e 147–325. Essa compatibilidade evita uma troca abrupta, mas aumenta o custo de futuras mudanças de autenticação e integridade.

## Funcionalidades e estado de validação

“Funcional e validada” nesta tabela significaria validação de comportamento na camada indicada; não significa disponibilidade de produção. Nenhum fluxo completo com banco real e navegador foi validado nesta auditoria.

| Funcionalidade | Classificação | Evidência e limite |
|---|---|---|
| Login, sessão, troca/recuperação de senha e papéis | Implementada sem validação suficiente do fluxo completo | Cookie, JWT, verificação de conta e guards existem em [auth.controller.ts](../../backend/src/auth/auth.controller.ts), linhas 13–42, [auth.guard.ts](../../backend/src/auth/auth.guard.ts), linhas 56–95, e [roles.guard.ts](../../backend/src/auth/roles.guard.ts), linhas 10–21. Há testes unitários; servidor, banco e navegador não foram exercitados juntos. |
| Painel executivo e filtros | Implementada sem validação suficiente | Consulta o endpoint de resumo e trata carregamento/erro em [dashboard.tsx](../../frontend/src/routes/_app/dashboard.tsx), linhas 176–225; agregações estão em [dashboard.service.ts](../../backend/src/dashboard/dashboard.service.ts), linhas 211–360. Dados atuais do banco e cálculos contra a carteira real não foram verificados. |
| Leads, detalhes, atividades e follow-up | Implementada sem validação suficiente | API e páginas existem; regras de autorização e ações comerciais têm testes unitários. Não houve fluxo HTTP autenticado nem validação operacional com usuários. Conversão manual é bloqueada para exigir confirmação oficial em [leads.service.ts](../../backend/src/leads/leads.service.ts), linhas 509–513. |
| Importação de carteira CSV/XLSX | Parcialmente funcional | Há normalização, validação e upsert em [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 345–471. Não foram avaliados o arquivo real, o mapeamento aprovado pela Deusa nem a conciliação de contas ausentes. |
| Descoberta de estabelecimentos por cidade/CNAE | Parcialmente funcional | O código consulta um CSV local da Receita Federal e grava empresas/leads em [receita-federal.provider.ts](../../backend/src/imports/providers/receita-federal.provider.ts), linhas 200–254 e 416–449, e [imports.service.ts](../../backend/src/imports/imports.service.ts), linhas 257–343. CSV ignorado pelo Git, sem prova de versão, e ausente da imagem Docker. A pesquisa não foi executada. |
| Sugestão individual de localização pelo Google Places | Implementada sem validação suficiente | A rota exige confirmação explícita e tem limite por rota em [companies.controller.ts](../../backend/src/companies/companies.controller.ts), linhas 126–141. A chamada depende de chave e disponibilidade externas; nada disso foi testado. Não é descoberta em lote. |
| Mapa de oportunidades | Parcialmente funcional | API e tela existem em [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 480–634, e [mapa-oportunidades.tsx](../../frontend/src/routes/_app/mapa-oportunidades.tsx), linhas 365–425 e 567–574. Parte das coordenadas é sintética ou central municipal. Aparência e dados não foram validados no navegador. |
| Mapa de calor | Parcialmente funcional | Há endpoint backend `GET /map/heatmap`; a rota frontend `/mapa-de-calor` apenas redireciona para mapa de oportunidades em [mapa-de-calor.tsx](../../frontend/src/routes/_app/mapa-de-calor.tsx), linhas 1–6. Não há tela independente verificada. |
| Rotas inteligentes, regiões prioritárias, recomendações e base de dados | Não implementadas como módulos independentes | As rotas redirecionam para mapa, dashboard, leads ou funil: [rotas-inteligentes.tsx](../../frontend/src/routes/_app/rotas-inteligentes.tsx), [regioes-prioritarias.tsx](../../frontend/src/routes/_app/regioes-prioritarias.tsx), [recomendacoes.tsx](../../frontend/src/routes/_app/recomendacoes.tsx) e [base-de-dados.tsx](../../frontend/src/routes/_app/base-de-dados.tsx). |
| Deusa Direto | Não implementada neste repositório | Não há rotas, entidades de pedido, carrinho, pagamento ou portal B2B identificados. Existe somente referência a URL externa da loja em [LeadDetailsSheet.tsx](../../frontend/src/features/leads/components/LeadDetailsSheet.tsx), linha 51; a operação dessa loja é externa e não verificada. |

## Testes e qualidade observados

| Verificação executada | Resultado | O que prova |
|---|---|---|
| `npm test` | Passou: 158 testes backend e 25 frontend | Regras unitárias, helpers, guards e serviços com dependências simuladas. O runner carrega arquivos `*.spec.ts` em [run-backend-tests.cjs](../../scripts/run-backend-tests.cjs), linhas 6–16, e [run-frontend-tests.mjs](../../scripts/run-frontend-tests.mjs), linhas 10–22. |
| `npm run typecheck` | Passou nos dois pacotes | Não encontrou erros TypeScript nas configurações atuais. |
| `npm run lint` | Passou nos dois pacotes | ESLint terminou sem avisos/erros. |
| E2E | Não executado | [e2e.test.ts](../../frontend/src/e2e.test.ts), linhas 4–12 e 40–83, exige servidores locais e credenciais; as sondagens locais não responderam. |
| Build, migration check, auditoria de dependências, banco e API real | Não executados | Build escreve artefatos; migration/DB poderiam tocar estado persistente; auditoria de dependências pode consultar rede. Não são evidência disponível neste relatório. |

O aviso de banco visto durante `npm test` foi o cenário intencional do teste de health check com `$queryRaw` simulado para falhar em [health.controller.spec.ts](../../backend/src/health/health.controller.spec.ts), linhas 24–32. Não foi uma consulta ao banco real. O frontend tem testes de serviços que, em parte, verificam apenas a existência de métodos; por exemplo, [dashboardService.spec.ts](../../frontend/src/services/dashboardService.spec.ts), linhas 1–6. A suíte padrão não executa o E2E.

## Segurança, manutenção e escalabilidade

- **Controles presentes no código:** `bcryptjs`, cookie `HttpOnly`, `Secure` em produção, `SameSite`, verificação JWT HS256 e estado/versão da conta; veja [auth.controller.ts](../../backend/src/auth/auth.controller.ts), linhas 13–28, e [auth.guard.ts](../../backend/src/auth/auth.guard.ts), linhas 56–95. Operações administrativas têm papéis no servidor; vendedores têm escopo de carteira em [lead-access.policy.ts](../../backend/src/common/lead-access.policy.ts), linhas 10–40.
- **Proteções HTTP:** Helmet, validação global de DTO, CORS, controle de origem/CSRF e identificador de requisição em [main.ts](../../backend/src/main.ts), linhas 75–160. O backend aplica limite de taxa por processo em [app.module.ts](../../backend/src/app.module.ts), linhas 25–58; isso não substitui rate limiting central quando há várias instâncias.
- **Banco:** há migration que ativa RLS e remove acesso direto de `anon`/`authenticated` em [20260827123000_lock_supabase_data_api/migration.sql](../../backend/prisma/migrations/20260827123000_lock_supabase_data_api/migration.sql), linhas 1–47. O papel backend recebe leitura ampla e políticas `USING (true)`, com writes específicos, linhas 68–110; o isolamento por vendedor depende dos guards/consultas NestJS. Aplicação real dessas migrations e configuração da role são **não verificadas**.
- **Operação:** há health endpoints, logs de auditoria e configuração de produção, mas não evidência de alertas, retenção de logs, WAF, backup restaurável ou resposta a incidentes ativos. O próprio [DEPLOY.md](../../DEPLOY.md), linhas 245–250 e 263–288, lista esses gates.
- **Cache:** dashboard e mapa mantêm cache em memória por instância; por exemplo, [map-opportunities.service.ts](../../backend/src/map-opportunities/map-opportunities.service.ts), linhas 472–487 e 632–633. Em escala horizontal, caches não são compartilhados; a expiração local não é prova de consistência distribuída.
- **Manutenção:** módulos backend e DTOs dão separação clara. Parte das telas concentra vários fluxos de filtro, renderização e ações; convém caracterizar comportamento antes de refatorar. Comprimento isolado do arquivo não é defeito.

## Decisão executiva

O Analytics é um protótipo funcional em código, com partes comerciais implementadas e testes unitários, mas sem evidência nesta auditoria de operação integrada no ambiente atual. Deve ser apresentado como ferramenta de demonstração/homologação com dados cuja procedência e geolocalização precisam de validação. Não apresentar “não cliente”, endereço no mapa ou volume de oportunidade como fatos confirmados sem reconciliação e evidência.
