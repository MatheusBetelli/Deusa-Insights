# Manual de Implantação e Produção (Deusa Insights)

Este documento descreve o procedimento completo para implantação do ecossistema **Deusa Insights** em ambiente de produção utilizando **Google Cloud Run** e **Supabase PostgreSQL**.

---

## 1. Arquitetura de Produção

```text
Frontend (TanStack Start SSR / Google Cloud Run)
      ↓ HTTPS REST (cookie JWT HttpOnly)
Backend (Google Cloud Run / Serverless)
      ↓ PrismaService único por instância (0.0.0.0:PORT)
Prisma ORM (v6.12.0)
      ├── Conexão Runtime (DATABASE_URL) → Pooler Supavisor (Porta 6543)
      └── Conexão Migrations (DIRECT_URL) → Conexão Direta (Porta 5432)
Supabase PostgreSQL
```

Esta é a topologia atualmente observada no projeto `deusa-analytics-prod`. O
frontend de produção recebe tráfego diretamente pelo serviço Cloud Run
`deusa-frontend`; não há um Cloudflare Worker nem um domínio customizado do
Cloud Run confirmado como parte do caminho atual. Os hosts `*.run.app` devem
ser tratados como URLs operacionais, não como domínio canônico.

---

## 2. Desenvolvimento Local

Para executar o ambiente localmente:

1. Subir o banco PostgreSQL local via Docker Compose:
   ```bash
   docker compose up -d postgres
   ```
2. Configurar o `.env` no backend copiando `backend/.env.example`.
3. Executar as migrações e o servidor backend:
   ```bash
   cd backend
   npm run prisma:generate
   npm run prisma:migrate
   npm run start:dev
   ```
4. Em outro terminal, executar o frontend:
   ```bash
   cd frontend
   npm run dev
   ```

---

## 3. Configuração do Supabase PostgreSQL

### A. Criar o Projeto e Connection Strings

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto.
2. Crie uma role exclusiva para runtime sem privilégios de `SUPERUSER`, `BYPASSRLS` ou DDL. A role lê a carteira congelada e só grava o mínimo necessário para autenticação e ações comerciais manuais:
   ```sql
   -- No Supabase SQL Editor:
   CREATE ROLE deusa_app_user WITH LOGIN PASSWORD 'use-um-segredo-do-vault'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
   ```
   A migration `20260827123000_lock_supabase_data_api` aplica RLS, revoga privilégios de `anon`/`authenticated` e concede à role `deusa_app_user` somente `SELECT` geral, writes de autenticação, updates comerciais limitados em `leads`, inserts em `lead_interactions` e inserts/updates controlados em `company_contacts`. Crie a role antes de `prisma migrate deploy`; se ela for criada depois, reaplique o SQL dessa migration de forma controlada.
3. Em `Project Settings -> Database -> Connection String`:
   - **Transaction Pooler** para `DATABASE_URL` da API no Cloud Run:
     `postgresql://deusa_app_user.[PROJECT_REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10`
   - **Direct Connection** para `DIRECT_URL` do job de migrations, quando o executor alcança IPv6 ou o projeto possui add-on IPv4:
     `postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres`
   - Em executor somente IPv4, use o **Session Pooler** administrativo na porta `5432`; copie a string exata exibida em **Connect** no painel Supabase.

### B. Banco Congelado

O banco Supabase existente é a SSOT. Deploys rotineiros não executam seed, importação, deduplicação, geocodificação nem restauração de dump. `DIRECT_URL` pertence exclusivamente à role de migração e só pode ser usada por um job controlado para `prisma migrate deploy` após backup e revisão do SQL.

### C. Data API

O frontend não usa Supabase diretamente. Mantenha a Data API/PostgREST desabilitada quando possível. Se ela permanecer ligada no projeto Supabase gerenciado, as roles `anon` e `authenticated` não devem possuir `USAGE` no schema `public` nem privilégios em tabelas/sequences. Nunca exponha `service_role`, `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` ou tokens administrativos em variáveis `VITE_*`.

---

## 4. Configuração no Google Cloud Platform (Cloud Run)

### A. Armazenar Secrets no Google Secret Manager

Cadastre no **Google Secret Manager** somente os valores sensíveis:

- `DATABASE_URL`: Connection string do pooler Supavisor (`:6543`).
- `JWT_SECRET`: Segredo aleatório e forte (mínimo de 32 caracteres).
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: credenciais do serviço de e-mail de recuperação.

Configure como variáveis não secretas de produção `ALLOWED_ORIGINS` e
`FRONTEND_URL` com origens HTTPS exatas, além de
`ENABLE_LEAD_MUTATIONS=false`, `ENABLE_COMMERCIAL_ACTIONS=true`,
`NODE_ENV=production` e `AUTH_COOKIE_SAME_SITE=lax`. Não injete `DIRECT_URL`,
`GOOGLE_MAPS_API_KEY`, `service_role` ou chaves Supabase administrativas no
serviço Cloud Run de rotina. O acesso individual pago, quando formalmente
aprovado, deve usar uma revisão temporária e auditada.

`RESEND_TEST_RECIPIENT` não pode existir em uma revisão de produção. A
aplicação falha fechada no startup se essa variável estiver presente; remova-a
somente depois de confirmar remetente e domínio no Resend.

### B. Build do Container e Push para o Artifact Registry

```bash
# 1. Autenticar no GCP
gcloud auth configure-docker southamerica-east1-docker.pkg.dev

# 2. Identificar a release e construir uma imagem imutável
RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
IMAGE_URI="southamerica-east1-docker.pkg.dev/[PROJECT_ID]/deusa-analytics/backend:${RELEASE_SHA}"
docker build -t "${IMAGE_URI}" -f backend/Dockerfile backend/

# 3. Push para o Artifact Registry
docker push "${IMAGE_URI}"
```

Registre o SHA e o digest retornado pelo Artifact Registry no ticket da release. Não promova `latest`.

### C. Executar Migrations como Etapa Pré-Deploy (Controlada)

Antes de liberar o tráfego para uma nova revisão do container:

```bash
cd backend
npx prisma migrate status
npx prisma migrate deploy
npx prisma migrate diff --exit-code --from-url "$DIRECT_URL" --to-schema-datamodel prisma/schema.prisma
```

Execute somente após o gate de CI, revisão do SQL, backup/PITR confirmado e teste de restauração vigente. Nunca use `migrate dev`, `db push`, `migrate reset` ou seed em produção.

### D. Deploy no Cloud Run

```bash
gcloud run deploy deusa-backend \
  --image="${IMAGE_URI}" \
  --region=southamerica-east1 \
  --allow-unauthenticated \
  --no-traffic \
  --tag=canary \
  --port=3001 \
  --concurrency=20 \
  --max-instances=3 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest,FRONTEND_URL=FRONTEND_URL:latest,RESEND_API_KEY=RESEND_API_KEY:latest,RESEND_FROM_EMAIL=RESEND_FROM_EMAIL:latest" \
  --set-env-vars="NODE_ENV=production,ENABLE_LEAD_MUTATIONS=false,ENABLE_COMMERCIAL_ACTIONS=true,AUTH_COOKIE_SAME_SITE=lax"
```

`DIRECT_URL` deve ficar disponível apenas para a etapa controlada de migrations. Com os valores acima, o Prisma abre no máximo 5 conexões por instância e o Cloud Run limita o total teórico da aplicação a 15 conexões.

Teste a URL da tag `canary` antes de liberar tráfego: `GET /health/live` deve provar que o processo está ativo e `GET /health/ready` deve confirmar o banco. Valide também login, RBAC e uma leitura de carteira. Em seguida, faça rollout gradual e observe erros, latência e conexões entre etapas:

```bash
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=5
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=25
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=100
```

Repita a mesma sequência para `deusa-frontend`, depois que o backend estiver
estável e a compatibilidade frontend/proxy estiver comprovada:

```bash
gcloud run services update-traffic deusa-frontend --region=southamerica-east1 --to-tags canary=5
gcloud run services update-traffic deusa-frontend --region=southamerica-east1 --to-tags canary=25
gcloud run services update-traffic deusa-frontend --region=southamerica-east1 --to-tags canary=50
gcloud run services update-traffic deusa-frontend --region=southamerica-east1 --to-tags canary=100
```

### E. Deploy oficial pelo GitHub

O único workflow oficial de publicação é o `Deploy Production Canary`. Ele
autentica por Workload Identity Federation, publica imagens identificadas pelo
SHA para backend e frontend e cria as duas revisões `canary` com 0% de tráfego.
Não cadastre chave JSON de service account no GitHub. Builds antigos disparados
diretamente pelo Cloud Build não devem ser usados para liberar produção.

Crie o environment protegido `production`, com revisor obrigatório, e configure estas GitHub Actions variables:

- `GCP_PROJECT_ID`
- `GCP_REGION` (recomendado: `southamerica-east1`)
- `GCP_ARTIFACT_REPOSITORY` (produção observada: `deusa-analytics`)
- `CLOUD_RUN_BACKEND_SERVICE` (exemplo: `deusa-backend`)
- `CLOUD_RUN_FRONTEND_SERVICE` (exemplo: `deusa-frontend`)
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOY_SERVICE_ACCOUNT`

Os dois serviços precisam existir previamente, com runtime service accounts,
Secret Manager, limites, ingress e acesso público revisados. Dispare o workflow
informando um SHA da `main` cujo CI esteja verde. O workflow nunca promove
tráfego automaticamente; faça smoke autenticado no canário e use os comandos
graduais abaixo somente após os gates de banco, e-mail e observabilidade.

O workflow confirma automaticamente que existe um run de push verde para o SHA
informado antes de autenticar no Google Cloud. Opcionalmente, informe as URLs
HTTPS das revisões canary nos inputs `backend_canary_url` e
`frontend_canary_url` para executar os smokes de saúde antes do encerramento do
workflow.

Antes de iniciar o container com os segredos reais, também é possível executar `npm run production:check`. O comando valida a presença e o formato da configuração sem imprimir valores secretos; ele exige `DIRECT_URL` ausente no runtime, `ENABLE_LEAD_MUTATIONS=false` e `ENABLE_COMMERCIAL_ACTIONS=true`.

### F. Deploy do Frontend no Cloud Run

O frontend não é uma SPA estática. O entrypoint `frontend/src/server.ts` executa
SSR, proxy `/api/*`, fallback de rotas e headers de segurança. A imagem é
construída pelo workflow oficial junto com o backend:

```bash
docker build --file frontend/Dockerfile --tag "${FRONTEND_IMAGE}" frontend/
docker push "${FRONTEND_IMAGE}"
gcloud run deploy deusa-frontend \
  --image="${FRONTEND_IMAGE}" \
  --region=southamerica-east1 \
  --no-traffic \
  --tag=canary
```

O runtime do frontend usa `BACKEND_ORIGIN` configurada no serviço Cloud Run e
o build usa `VITE_API_URL=/api`, mantendo o cookie no mesmo host do frontend.
Não use `wrangler deploy` como caminho de produção enquanto a topologia real
for Cloud Run.

Antes de liberar tráfego, valide por acesso direto `/login`, `/dashboard`,
`/leads-b2b` e `/mapa-oportunidades`.

### G. Healthchecks públicos e internos

- Backend direto: `GET /health/live` e `GET /health/ready`.
- Frontend público: `GET /api/health/ready`, que passa pelo proxy para o backend.
- Frontend interno: `/healthz` é usado pelo `HEALTHCHECK` do Docker e responde
  `200` no servidor Node local. O front door público das revisões observadas
  respondeu `404` nesse caminho; portanto `/healthz` não é contrato público e
  não deve ser usado no monitoramento externo até que a exposição seja
  comprovada em uma revisão implantada.

### H. Domínio canônico

Não há mapeamento de domínio Cloud Run confirmado atualmente. Quando houver uma
decisão de domínio, o desenho recomendado é `app.<dominio>` para o frontend e
`api.<dominio>` somente se o proxy `/api` deixar de ser usado. Será necessário
validar DNS, certificado TLS, `FRONTEND_URL`, `ALLOWED_ORIGINS`, redirects e a
política de cookie. Com frontend e backend sob o mesmo site registrável,
`AUTH_COOKIE_SAME_SITE=lax` continua apropriado; não altere para `none` sem
necessidade.

### I. Controles Operacionais Obrigatórios

- A limitação do NestJS é local a cada instância. Configure rate limiting centralizado e regras WAF no Load Balancer/Cloud Armor (ou gateway equivalente), especialmente para `/auth/*` e exportações. A existência desse controle não deve ser presumida apenas pelo código.
- Encaminhe logs JSON do Cloud Run para retenção central, com acesso restrito e alertas para falhas de login, bloqueios de mutação, 5xx, latência e saturação do banco.
- Defina responsáveis, RTO/RPO, rotação de segredos e teste periódico de restauração. Backup existente sem evidência de restauração não encerra o gate.
- Use uma service account exclusiva para o Cloud Run, sem permissões de owner/editor, e conceda acesso somente aos secrets necessários.

---

## 5. Estratégia de Rollback Seguro

Se houver falha após um novo deploy:

1. Reverta 100% do tráfego para o nome exato da revisão anterior: `gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-revisions [REVISAO_ANTERIOR]=100`.
2. Como as migrations do Prisma são acumulativas (sem comandos destrutivos `DROP`), o schema permanecerá compatível com a revisão anterior.

---

## 6. Checklist Final de Liberação (Smoke Test)

```text
[ ] Instância Supabase criada e ativa
[ ] Connection Strings (DATABASE_URL e DIRECT_URL) testadas
[ ] `DATABASE_URL` usa role runtime sem `SUPERUSER`, `BYPASSRLS` ou DDL
[ ] `DIRECT_URL` administrativa não está disponível no container runtime
[ ] Data API/PostgREST desabilitada ou roles `anon`/`authenticated` sem privilégios em `public`
[ ] Migrations aplicadas via `npx prisma migrate deploy`
[ ] CI validou migrations do zero e ausência de drift em PostgreSQL efêmero
[ ] Backup/PITR confirmado e restauração testada dentro do RTO/RPO acordado
[ ] Contagens congeladas e foreign keys verificadas somente por consultas `SELECT`
[ ] Segredos cadastrados no Google Secret Manager
[ ] Container publicado no Artifact Registry
[ ] Serviço Cloud Run configurado na porta dinâmica ($PORT / 0.0.0.0)
[ ] `GET /health/live` e `GET /health/ready` respondem `status: ok`
[ ] CORS validado apenas para a URL real do frontend
[ ] CSP do frontend e do backend validada no navegador
[ ] `ENABLE_LEAD_MUTATIONS=false` confirmado na revisão ativa
[ ] `ENABLE_COMMERCIAL_ACTIONS=true` confirmado na revisão ativa
[ ] Limites de conexão, concorrência e número de instâncias conferidos
[ ] Login, logout e `/auth/me` validados com cookie `HttpOnly`, `Secure` e sem JWT no corpo
[ ] Frontend e backend usam domínios compatíveis com a política `SameSite`
[ ] Imagem identificada por SHA/digest e revisão canary validada antes de receber tráfego
[ ] Alertas de erro 5xx, latência, saturação de conexões e falha de readiness configurados
[ ] Branch `main` protegida com PR obrigatório e gates `migration-check` e `build-and-test`
```
