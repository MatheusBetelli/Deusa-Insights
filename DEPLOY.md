# Manual de Implantação e Produção (Deusa Insights)

Este documento descreve o procedimento completo para implantação do ecossistema **Deusa Insights** em ambiente de produção utilizando **Google Cloud Run** e **Supabase PostgreSQL**.

---

## 1. Arquitetura de Produção

```text
Frontend (Vite / React em CDN)
      ↓ HTTPS REST (JWT Bearer)
Backend (Google Cloud Run / Serverless)
      ↓ Singleton PrismaService (0.0.0.0:PORT)
Prisma ORM (v6.19.0)
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
2. Em `Project Settings -> Database -> Connection String`:
   - Copie a string **Transaction Connection Pooler** (para `DATABASE_URL`):
     `postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true`
   - Copie a string **Direct Connection** (para `DIRECT_URL`):
     `postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres`

### B. Migração de Dados Existentes (Sem Perda)
Para migrar uma base local/existente para o Supabase sem duplicar ou regenerar IDs:
1. Exportar os dados com `pg_dump`:
   ```bash
   pg_dump -h localhost -p 5435 -U deusa_dev -d deusa_analytics --data-only --inserts -f dump_data.sql
   ```
2. Aplicar o schema no Supabase via Prisma CLI:
   ```bash
   cd backend
   DIRECT_URL="postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres" npx prisma migrate deploy
   ```
3. Importar os dados para o Supabase:
   ```bash
   psql "postgresql://postgres.[PROJECT-REF]:[SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres" -f dump_data.sql
   ```
4. Validar quantidade de registros (`SELECT COUNT(*) FROM companies`, etc.).

---

## 4. Configuração no Google Cloud Platform (Cloud Run)

### A. Armazenar Secrets no Google Secret Manager
Cadastre os seguintes segredos no **Google Secret Manager**:
- `DATABASE_URL`: Connection string do pooler Supavisor (`:6543`).
- `DIRECT_URL`: Connection string direta (`:5432`).
- `JWT_SECRET`: Segredo aleatório e forte (mínimo de 32 caracteres).
- `ALLOWED_ORIGINS`: Domínio real do frontend (ex: `https://app.deusainsights.com.br`).
- `FRONTEND_URL`: URL principal do frontend, usada nos links de recuperação de senha.
- `RESEND_API_KEY` e `RESEND_FROM_EMAIL`: credenciais do serviço de e-mail de recuperação.

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
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,DIRECT_URL=DIRECT_URL:latest,JWT_SECRET=JWT_SECRET:latest,ALLOWED_ORIGINS=ALLOWED_ORIGINS:latest,FRONTEND_URL=FRONTEND_URL:latest,RESEND_API_KEY=RESEND_API_KEY:latest,RESEND_FROM_EMAIL=RESEND_FROM_EMAIL:latest" \
  --set-env-vars="NODE_ENV=production"
```

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
[ ] Migrations aplicadas via `npx prisma migrate deploy`
[ ] Registros e foreign keys verificados no Supabase Studio
[ ] Segredos cadastrados no Google Secret Manager
[ ] Container publicado no Artifact Registry
[ ] Serviço Cloud Run configurado na porta dinâmica ($PORT / 0.0.0.0)
[ ] Endpoint GET /health respondendo status 'ok' em produção
[ ] CORS validado apenas para a URL real do frontend
[ ] Teste de login JWT funcional
```
