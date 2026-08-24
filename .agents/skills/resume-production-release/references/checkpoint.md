# Checkpoint da entrega de producao

Atualizado em 2026-08-24, no branch `main`, antes do push ao GitHub.

## Objetivo e autorizacao

O usuario pediu para corrigir backend e Docker, verificar testes, separar as mudancas em diversos commits e enviar diretamente para `main`. Reconfirme essa autorizacao no contexto ativo antes do push. Nao houve autorizacao para deploy na infraestrutura de producao, alteracao do banco real ou chamadas pagas.

## Commits locais concluidos

- `b86cc4c fix(security): harden cookie auth and production guards`
- `3986260 refactor(backend): enforce frozen commercial data flows`
- `22813ab fix(database): reconcile production migration history`

O `origin/main` observado apontava para `2e6a310`; a branch local estava tres commits a frente e sem commits remotos exclusivos. Nao reescreva esses commits.

## Mudancas restantes e divisao planejada

O worktree ainda contem frontend, CI/qualidade e empacotamento/documentacao. Revise o estado atual antes de adicionar ao indice.

1. `refactor(frontend): remove dead UI and align data contracts`: codigo em `frontend/src`, tipos, utilitario de dados, manifests/lockfile, ESLint, TypeScript e `.env.example`. Deixe `vite.config.ts`, `wrangler.jsonc` e `knip.json` para os grupos seguintes.
2. `ci: enforce production release quality gates`: workflow, Gitleaks, higiene, test runners, Knip, configuracao de lint/backend e manifests raiz/backend.
3. `build(deploy): harden production packaging`: Dockerfile/.dockerignore, configuracao Cloudflare/Vite, exemplos de ambiente e documentacao; inclui remover o `docker-compose.prod.yml` obsoleto.

Use `git diff --cached --check` e revise o resumo antes de cada commit.

## Evidencias ja obtidas

- Backend: lint e typecheck passaram; 82 de 82 testes passaram.
- Frontend: 18 de 18 testes passaram; build de producao passou.
- E2E isolado: 8 de 8 cenarios passaram com cookie HttpOnly.
- Auditoria npm: zero vulnerabilidades nos tres manifests.
- Prisma: schema validado/gerado; cinco migrations aplicadas em PostgreSQL efemero, status atualizado e diff vazio.
- Docker: imagem de producao construiu e `/health` respondeu com banco conectado em ambiente efemero.
- Cloudflare: dry-run passou sem bindings sensiveis.

O banco local real foi somente consultado para status/diff e nao foi migrado. Nenhuma API Google/paga foi chamada. Recursos Docker efemeros foram removidos.

## Validacao ainda obrigatoria

Depois dos commits restantes, repita higiene, lint, typecheck, deadcode, todos os testes, build com `VITE_API_URL` nao sensivel, auditoria e `git diff --check`. Reconstrua a imagem Docker com o HEAD final e execute um smoke test sem mutar dados. Repita o dry-run Cloudflare.

Em seguida, execute `git fetch origin`, confirme que `origin/main` nao avancou, envie sem force e verifique `HEAD == origin/main`. Acompanhe o workflow do GitHub; se falhar, corrija e valide antes de declarar a entrega pronta.
