# Guia de Preparação e Integração Supabase PostgreSQL (Deusa Insights)

Este documento detalha a arquitetura preparada, a configuração de banco de dados e os passos exatos para conectar o **Deusa Insights** a uma instância do **Supabase PostgreSQL** em nuvem ou ambiente gerenciado.

---

## 1. Ambiente Atual (Desenvolvimento Local)

Atualmente, o projeto utiliza:
* **Banco de Dados**: PostgreSQL 16 Alpine via Docker Container (`docker-compose.yml` / container `deusa-analytics-postgres`).
* **ORM**: Prisma ORM v6 (`@prisma/client` e `prisma` CLI `6.12.0`).
* **Backend**: Framework NestJS v11 rodando com cliente Prisma em padrão `@Global()` (singleton `PrismaService`).

---

## 2. Ambiente Preparado (Supabase PostgreSQL)

A arquitetura foi ajustada para suportar a transição transparente sem alterações de código no Backend ou Frontend:

```
Frontend (TanStack Start / React)
      ↓ HTTPS REST (cookie JWT HttpOnly)
Backend NestJS (Google Cloud Run / Serverless)
      ↓ NestJS Global Singleton (PrismaService)
Prisma ORM (v6.12.0)
      ├── Conexão Runtime (DATABASE_URL) → Supavisor Pooler (Porta 6543)
      └── Conexão Migrations (DIRECT_URL) → Conexão Direta (Porta 5432)
PostgreSQL (Supabase)
```

> **Importante**: O Frontend **nunca acessa o Supabase diretamente**. Toda comunicação de dados passa pelas controllers, services, DTOs e guardas de autenticação do backend NestJS.

---

## 3. Configuração de Variáveis de Ambiente

Ao conectar a aplicação a um projeto Supabase real, configure as seguintes variáveis no arquivo `.env` (ou no painel de segredos do **Google Cloud Secret Manager / Cloud Run**):

```env
# 1. DATABASE_URL (Pooler Supavisor na porta 6543 para runtime)
DATABASE_URL="postgresql://deusa_app_user.[SEU-PROJECT-REF]:[SUA-SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=5&pool_timeout=10"

# 2. DIRECT_URL (Conexão administrativa usada somente para migrations e DDL)
DIRECT_URL="postgresql://postgres.[SEU-PROJECT-REF]:[SUA-SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres"
```

### Explicação dos Parâmetros:
* **`DATABASE_URL`**: usa a role runtime `deusa_app_user`, sem `SUPERUSER`, `BYPASSRLS` ou DDL, via pooler de transação na porta `6543`.
* **`DIRECT_URL`**: usa uma role administrativa apenas no job controlado de `prisma migrate deploy`. Essa variável não deve existir no container Cloud Run de rotina.

Nunca configure `service_role`, `anon key`, `DATABASE_URL`, `DIRECT_URL` ou `JWT_SECRET` no frontend. Variáveis públicas do frontend devem ficar limitadas a `VITE_API_URL` e `VITE_STORE_URL`.

---

## 4. RLS e Data API

O frontend não deve acessar PostgREST/Supabase Data API. O arquivo `supabase/config.toml` mantém `[api].enabled = false` para ambientes CLI locais. Em um projeto Supabase gerenciado, se a Data API continuar ativa no painel, as roles `anon` e `authenticated` devem permanecer sem `USAGE` no schema `public` e sem privilégios nas tabelas/sequences.

A migration `20260827123000_lock_supabase_data_api`:
* habilita RLS nas tabelas da aplicação;
* revoga privilégios das roles `anon` e `authenticated`;
* concede à role `deusa_app_user` leitura geral e apenas as escritas necessárias para autenticação e ações comerciais manuais;
* permite `UPDATE` limitado em `leads`, `INSERT` em `lead_interactions` e `INSERT/UPDATE` controlado em `company_contacts`.

Crie a role `deusa_app_user` antes de aplicar as migrations. Se a role for criada depois, reaplique o SQL dessa migration de forma controlada.

---

## 5. Connection Pooling no Google Cloud Run

Quando o backend NestJS for implantado no Google Cloud Run:
1. O backend rodará instâncias concorrentes sob demanda.
2. O `PrismaService` continuará gerenciando um único cliente Prisma por container NestJS.
3. As conexões serão roteadas pelo **Supavisor** (`DATABASE_URL`), mantendo o uso de memória e sockets sob controle.

---

## 6. Passos Exatos para Conectar ao Supabase

Para conectar o projeto a uma instância real do Supabase:

1. **Criar o Projeto no Supabase**:
   - Acesse [supabase.com](https://supabase.com) e crie um novo projeto PostgreSQL.
2. **Obter as Connection Strings**:
   - No painel do Supabase, acesse `Project Settings -> Database -> Connection String`.
   - Copie a string **Transaction Connection Pooler** e substitua o usuário pela role `deusa_app_user` para `DATABASE_URL`.
   - Copie a string **Direct Connection** ou session pooler administrativo para `DIRECT_URL`, somente no executor de migrations.
3. **Preencher as Variáveis de Ambiente**:
   - Atualize `.env` localmente ou insira os segredos no Cloud Run.
4. **Executar a Migração das Tabelas**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
5. **Seed apenas em base nova ou descartável**:
   ```bash
   cd backend
   RUN_SEED=true npm run seed
   ```
   Não execute seed, importação, deduplicação, discovery ou geocoding em uma base real sem autorização explícita, volume estimado e revisão de custo/impacto.
