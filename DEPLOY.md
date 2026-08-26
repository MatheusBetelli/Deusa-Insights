# Manual de Implantação e Produção (Deusa Insights)

Este documento descreve o procedimento completo para implantação do ecossistema **Deusa Insights** em ambiente de produção utilizando **Google Cloud Run** e **Supabase PostgreSQL**.

---

## 1. Arquitetura de Produção

```text
Frontend (TanStack Start SSR / Cloudflare Worker)
      ↓ HTTPS REST (cookie JWT HttpOnly)
Backend (Google Cloud Run / Serverless)
      ↓ PrismaService único por instância (0.0.0.0:PORT)
Prisma ORM (v6.12.0)
      ├── Conexão Runtime (DATABASE_URL) → Pooler Supavisor (Porta 6543)
      └── Conexão Migrations (DIRECT_URL) → Conexão Direta (Porta 5432)
Supabase PostgreSQL
```

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
2. Crie uma role exclusiva para runtime sem privilégios de `SUPERUSER`, `BYPASSRLS` ou DDL. A role lê a carteira congelada e só grava usuários de autenticação:
   ```sql
   -- No Supabase SQL Editor:
   CREATE ROLE deusa_app_user WITH LOGIN PASSWORD 'use-um-segredo-do-vault'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
   GRANT CONNECT ON DATABASE postgres TO deusa_app_user;
   GRANT USAGE ON SCHEMA public TO deusa_app_user;
   GRANT SELECT ON ALL TABLES IN SCHEMA public TO deusa_app_user;
   GRANT INSERT, UPDATE, DELETE ON TABLE public.users TO deusa_app_user;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO deusa_app_user;
   REVOKE INSERT, UPDATE, DELETE ON TABLE
     public.cities, public.cnaes, public.companies, public.company_cnaes,
     public.client_accounts, public.leads, public.lead_interactions,
     public.import_jobs, public.company_details, public.profiles,
     public.user_mappings
   FROM deusa_app_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT ON TABLES TO deusa_app_user;
   ```
3. Em `Project Settings -> Database -> Connection String`:
   - **Transaction Pooler** para `DATABASE_URL` da API no Cloud Run:
     `postgresql://deusa_app_user.[PROJECT_REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10`
   - **Direct Connection** para `DIRECT_URL` do job de migrations, quando o executor alcança IPv6 ou o projeto possui add-on IPv4:
     `postgresql://postgres:[SENHA]@db.[PROJECT_REF].supabase.co:5432/postgres`
   - Em executor somente IPv4, use o **Session Pooler** administrativo na porta `5432`; copie a string exata exibida em **Connect** no painel Supabase.

### B. Banco Congelado
O banco Supabase existente é a SSOT. Deploys rotineiros não executam seed, importação, deduplicação, geocodificação nem restauração de dump. `DIRECT_URL` pertence exclusivamente à role de migração e só pode ser usada por um job controlado para `prisma migrate deploy` após backup e revisão do SQL.

---

## 4. Configuração no Google Cloud Platform (Cloud Run)

### A. Armazenar Secrets no Google Secret Manager
Cadastre os seguintes segredos no **Google Secret Manager**:
- `DATABASE_URL`: Connection string do pooler Supavisor (`:6543`).
- `JWT_SECRET`: Segredo aleatório e forte (mínimo de 32 caracteres).
- `ALLOWED_ORIGINS`: Domínio real do frontend (ex: `https://app.deusainsights.com.br`).
- `FRONTEND_URL`: URL principal do frontend, usada nos links de recuperação de senha.
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: credenciais do serviço de e-mail de recuperação.
- `ENABLE_LEAD_MUTATIONS=false`: trava obrigatória da carteira congelada.

Não injete `DIRECT_URL` nem `GOOGLE_MAPS_API_KEY` no serviço Cloud Run de rotina. O acesso individual pago, quando formalmente aprovado, deve usar uma revisão temporária e auditada.

### B. Build do Container e Push para o Artifact Registry
```bash
# 1. Autenticar no GCP
gcloud auth configure-docker br-sa-east1-docker.pkg.dev

# 2. Identificar a release e construir uma imagem imutável
RELEASE_SHA="$(git rev-parse --short=12 HEAD)"
IMAGE_URI="br-sa-east1-docker.pkg.dev/[PROJECT_ID]/deusa-repo/backend:${RELEASE_SHA}"
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
  --set-env-vars="NODE_ENV=production,ENABLE_LEAD_MUTATIONS=false,AUTH_COOKIE_SAME_SITE=lax"
```

`DIRECT_URL` deve ficar disponível apenas para a etapa controlada de migrations. Com os valores acima, o Prisma abre no máximo 5 conexões por instância e o Cloud Run limita o total teórico da aplicação a 15 conexões.

Teste a URL da tag `canary` antes de liberar tráfego: `GET /health/live` deve provar que o processo está ativo e `GET /health/ready` deve confirmar o banco. Valide também login, RBAC e uma leitura de carteira. Em seguida, faça rollout gradual e observe erros, latência e conexões entre etapas:

```bash
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=5
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=25
gcloud run services update-traffic deusa-backend --region=southamerica-east1 --to-tags canary=100
```

### E. Deploy do Frontend no Cloudflare Worker
O frontend não é uma SPA estática. O entrypoint `frontend/src/server.ts` executa SSR, fallback de rotas e headers de segurança.

```bash
cd frontend
VITE_API_URL=https://api.seu-dominio.com npm run deploy
```

Use domínios sob o mesmo site registrável, por exemplo `app.deusainsights.com.br` e `api.deusainsights.com.br`, para manter `SameSite=Lax`. Se a topologia exigir sites diferentes, configure `AUTH_COOKIE_SAME_SITE=none`, mantenha `Secure` e valide a proteção de origem antes do corte.

Antes de liberar tráfego, valide por acesso direto `/login`, `/dashboard`, `/leads-b2b` e `/mapa-oportunidades`.

### F. Controles Operacionais Obrigatórios

- A limitação do NestJS é local a cada instância. Configure rate limiting centralizado e regras WAF no Load Balancer/Cloud Armor (ou gateway equivalente), especialmente para `/auth/*` e exportações.
- Encaminhe logs JSON do Cloud Run e logs do Cloudflare para retenção central, com acesso restrito e alertas para falhas de login, bloqueios de mutação, 5xx, latência e saturação do banco.
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
[ ] Limites de conexão, concorrência e número de instâncias conferidos
[ ] Login, logout e `/auth/me` validados com cookie `HttpOnly`, `Secure` e sem JWT no corpo
[ ] Cloudflare e Cloud Run usam domínios compatíveis com a política `SameSite`
[ ] Imagem identificada por SHA/digest e revisão canary validada antes de receber tráfego
[ ] Alertas de erro 5xx, latência, saturação de conexões e falha de readiness configurados
[ ] Branch `main` protegida com PR obrigatório e gates `migration-check` e `build-and-test`
```
