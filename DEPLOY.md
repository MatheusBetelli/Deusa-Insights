# Manual de Implantação e Produção (Deusa Insights)

Este documento descreve o procedimento completo para implantação do ecossistema **Deusa Insights** em ambiente de produção utilizando **Google Cloud Run** e **Supabase PostgreSQL**.

---

## 1. Arquitetura de Produção

```text
Frontend (TanStack Start SSR / Cloudflare Worker)
      ↓ HTTPS REST (cookie JWT HttpOnly)
Backend (Google Cloud Run / Serverless)
      ↓ Singleton PrismaService (0.0.0.0:PORT)
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
   - Configuração **Transaction Connection Pooler** (para `DATABASE_URL` runtime da API):
     `postgresql://deusa_app_user:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10`
   - Configuração **Direct Connection** (somente para `DIRECT_URL` de migrations administrativas via CI/CD):
     `postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres`

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

# 2. Build da imagem
docker build -t br-sa-east1-docker.pkg.dev/[PROJECT_ID]/deusa-repo/backend:latest -f backend/Dockerfile backend/

# 3. Push para o Artifact Registry
docker push br-sa-east1-docker.pkg.dev/[PROJECT_ID]/deusa-repo/backend:latest
```

### C. Executar Migrations como Etapa Pré-Deploy (Controlada)
Antes de liberar o tráfego para uma nova revisão do container:
```bash
# Executar a migração do schema via CLI em ambiente seguro/CI
npx prisma migrate deploy
```

### D. Deploy no Cloud Run
```bash
gcloud run deploy deusa-backend \
  --image=br-sa-east1-docker.pkg.dev/[PROJECT_ID]/deusa-repo/backend:latest \
  --region=southamerica-east1 \
  --allow-unauthenticated \
  --port=3001 \
  --concurrency=20 \
  --max-instances=3 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest,FRONTEND_URL=FRONTEND_URL:latest,RESEND_API_KEY=RESEND_API_KEY:latest,RESEND_FROM_EMAIL=RESEND_FROM_EMAIL:latest" \
  --set-env-vars="NODE_ENV=production,ENABLE_LEAD_MUTATIONS=false,AUTH_COOKIE_SAME_SITE=lax"
```

`DIRECT_URL` deve ficar disponível apenas para a etapa controlada de migrations. Com os valores acima, o Prisma abre no máximo 5 conexões por instância e o Cloud Run limita o total teórico da aplicação a 15 conexões.

### E. Deploy do Frontend no Cloudflare Worker
O frontend não é uma SPA estática. O entrypoint `frontend/src/server.ts` executa SSR, fallback de rotas e headers de segurança.

```bash
cd frontend
VITE_API_URL=https://api.seu-dominio.com npm run deploy
```

Use domínios sob o mesmo site registrável, por exemplo `app.deusainsights.com.br` e `api.deusainsights.com.br`, para manter `SameSite=Lax`. Se a topologia exigir sites diferentes, configure `AUTH_COOKIE_SAME_SITE=none`, mantenha `Secure` e valide a proteção de origem antes do corte.

Antes de liberar tráfego, valide por acesso direto `/login`, `/dashboard`, `/leads-b2b` e `/mapa-oportunidades`.

---

## 5. Estratégia de Rollback Seguro

Se houver falha após um novo deploy:
1. No painel do **Google Cloud Run**, reverta o tráfego para a revisão anterior estável.
2. Como as migrations do Prisma são acumulativas (sem comandos destrutivos `DROP`), o schema permanecerá compatível com a revisão anterior.

---

## 6. Checklist Final de Liberação (Smoke Test)

```text
[ ] Instância Supabase criada e ativa
[ ] Connection Strings (DATABASE_URL e DIRECT_URL) testadas
[ ] `DATABASE_URL` usa role runtime sem `SUPERUSER`, `BYPASSRLS` ou DDL
[ ] `DIRECT_URL` administrativa não está disponível no container runtime
[ ] Migrations aplicadas via `npx prisma migrate deploy`
[ ] Contagens congeladas e foreign keys verificadas somente por consultas `SELECT`
[ ] Segredos cadastrados no Google Secret Manager
[ ] Container publicado no Artifact Registry
[ ] Serviço Cloud Run configurado na porta dinâmica ($PORT / 0.0.0.0)
[ ] Endpoint GET /health respondendo status 'ok' em produção
[ ] CORS validado apenas para a URL real do frontend
[ ] CSP do frontend e do backend validada no navegador
[ ] `ENABLE_LEAD_MUTATIONS=false` confirmado na revisão ativa
[ ] Limites de conexão, concorrência e número de instâncias conferidos
[ ] Login, logout e `/auth/me` validados com cookie `HttpOnly`, `Secure` e sem JWT no corpo
[ ] Cloudflare e Cloud Run usam domínios compatíveis com a política `SameSite`
```
