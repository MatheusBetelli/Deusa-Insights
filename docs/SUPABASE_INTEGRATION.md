# Guia de Preparação e Integração Supabase PostgreSQL (Deusa Insights)

Este documento detalha a arquitetura preparada, a configuração de banco de dados e os passos exatos para conectar o **Deusa Insights** a uma instância do **Supabase PostgreSQL** em nuvem ou ambiente gerenciado.

---

## 1. Ambiente Atual (Desenvolvimento Local)

Atualmente, o projeto utiliza:
* **Banco de Dados**: PostgreSQL 16 Alpine via Docker Container (`docker-compose.yml` / container `deusa-analytics-postgres`).
* **ORM**: Prisma ORM v6 (`@prisma/client` e `prisma` CLI `6.19.0`).
* **Backend**: Framework NestJS v11 rodando com cliente Prisma em padrão `@Global()` (singleton `PrismaService`).

---

## 2. Ambiente Preparado (Supabase PostgreSQL)

A arquitetura foi ajustada para suportar a transição transparente sem alterações de código no Backend ou Frontend:

```
Frontend (Vite / React)
      ↓ HTTP REST (JWT)
Backend NestJS (Google Cloud Run / Serverless)
      ↓ NestJS Global Singleton (PrismaService)
Prisma ORM (v6.19.0)
      ├── Conexão Runtime (DATABASE_URL) → Supavisor Pooler (Porta 6543)
      └── Conexão Migrations (DIRECT_URL) → Conexão Direta (Porta 5432)
PostgreSQL (Supabase)
```

> **Importante**: O Frontend **nunca acessa o Supabase diretamente**. Toda comunicação de dados passa pelas controllers, services, DTOs e guardas de autenticação do backend NestJS.

---

## 3. Configuração de Variáveis de Ambiente

Ao conectar a aplicação a um projeto Supabase real, configure as seguintes variáveis no arquivo `.env` (ou no painel de segredos do **Google Cloud Secret Manager / Cloud Run**):

```env
# 1. DATABASE_URL (Conexão via Pooler Supavisor na porta 6543 para a aplicação em runtime)
DATABASE_URL="postgresql://postgres.[SEU-PROJECT-REF]:[SUA-SENHA]@aws-0-[REGIAO].pooler.supabase.com:6543/postgres?pgbouncer=true"

# 2. DIRECT_URL (Conexão direta na porta 5432 utilizada pelo Prisma para aplicar migrations e DDL)
DIRECT_URL="postgresql://postgres.[SEU-PROJECT-REF]:[SUA-SENHA]@aws-0-[REGIAO].pooler.supabase.com:5432/postgres"
```

### Explicação dos Parâmetros:
* **`DATABASE_URL`**: Aponta para a porta `6543` com suporte a `pgbouncer=true` (pooler de conexões em modo transação da Supabase), evitando estouro de limite de conexões em ambientes serverless como o Cloud Run.
* **`DIRECT_URL`**: Aponta diretamente para a porta `5432` da base de dados PostgreSQL, permitindo que a CLI do Prisma execute `prisma migrate deploy` sem bloqueios do pooler.

---

## 4. Connection Pooling no Google Cloud Run

Quando o backend NestJS for implantado no Google Cloud Run:
1. O backend rodará instâncias concorrentes sob demanda.
2. O `PrismaService` continuará gerenciando um único cliente Prisma por container NestJS.
3. As conexões serão roteadas pelo **Supavisor** (`DATABASE_URL`), mantendo o uso de memória e sockets sob controle.

---

## 5. Passos Exatos para Conectar ao Supabase no Futuro

Quando você decidir conectar o projeto a uma instância real do Supabase:

1. **Criar o Projeto no Supabase**:
   - Acesse [supabase.com](https://supabase.com) e crie um novo projeto PostgreSQL.
2. **Obter as Connection Strings**:
   - No painel do Supabase, acesse `Project Settings -> Database -> Connection String`.
   - Copie a string **Transaction Connection Pooler** (para `DATABASE_URL`).
   - Copie a string **Direct Connection** (para `DIRECT_URL`).
3. **Preencher as Variáveis de Ambiente**:
   - Atualize `.env` localmente ou insira os segredos no Cloud Run.
4. **Executar a Migração das Tabelas**:
   ```bash
   cd backend
   npx prisma migrate deploy
   ```
5. **Executar o Seed da Base (opcional)**:
   ```bash
   cd backend
   RUN_SEED=true npm run seed
   ```
   Execute somente em uma base nova e revisada; o seed não deve ser usado para reimportar dados existentes.
