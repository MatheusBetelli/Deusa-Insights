-- Reconcile structures that existed in the Prisma schema but were missing from
-- the migration history. The conditional statements also support databases
-- where these structures were previously applied with `prisma db push`.

-- Preserve legacy user assignments before adding the UUID profile relations.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'assignedToId'
      AND data_type = 'text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'leads'
      AND column_name = 'assignedToId_legacy'
  ) THEN
    ALTER TABLE "leads" DROP CONSTRAINT IF EXISTS "leads_assignedToId_fkey";
    ALTER TABLE "leads" RENAME COLUMN "assignedToId" TO "assignedToId_legacy";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_interactions'
      AND column_name = 'userId'
      AND data_type = 'text'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'lead_interactions'
      AND column_name = 'userId_legacy'
  ) THEN
    ALTER TABLE "lead_interactions" DROP CONSTRAINT IF EXISTS "lead_interactions_userId_fkey";
    DROP INDEX IF EXISTS "lead_interactions_userId_idx";
    ALTER TABLE "lead_interactions" RENAME COLUMN "userId" TO "userId_legacy";
  END IF;
END $$;

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "externalId" TEXT,
  ALTER COLUMN "cnpj" DROP NOT NULL,
  ALTER COLUMN "source" SET DEFAULT 'receita_federal';

ALTER TABLE "leads"
  ADD COLUMN IF NOT EXISTS "assignedToId_legacy" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedToId" UUID;

ALTER TABLE "lead_interactions"
  ADD COLUMN IF NOT EXISTS "userId_legacy" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" UUID,
  ALTER COLUMN "userId_legacy" DROP NOT NULL;

CREATE TABLE IF NOT EXISTS "user_mappings" (
  "cuid" TEXT NOT NULL,
  "uuid" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_mappings_pkey" PRIMARY KEY ("cuid")
);

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'SALES',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "client_accounts" (
  "id" TEXT NOT NULL,
  "codigoClienteDeusa" TEXT,
  "cnpj" TEXT,
  "razaoSocial" TEXT NOT NULL,
  "nomeFantasia" TEXT,
  "isCurrentClient" BOOLEAN NOT NULL DEFAULT true,
  "grupoEconomico" TEXT,
  "segmentoAtuacao" TEXT,
  "cidade" TEXT,
  "uf" TEXT,
  "companyId" TEXT,
  "importedFromExcel" BOOLEAN NOT NULL DEFAULT true,
  "lastImportAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "company_details" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "naturezaJuridica" TEXT,
  "telefone" TEXT,
  "email" TEXT,
  "descricaoCnae" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "company_details_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_mappings_uuid_key" ON "user_mappings"("uuid");
CREATE UNIQUE INDEX IF NOT EXISTS "profiles_email_key" ON "profiles"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "client_accounts_codigoClienteDeusa_key" ON "client_accounts"("codigoClienteDeusa");
CREATE INDEX IF NOT EXISTS "client_accounts_cnpj_idx" ON "client_accounts"("cnpj");
CREATE INDEX IF NOT EXISTS "client_accounts_companyId_idx" ON "client_accounts"("companyId");
CREATE INDEX IF NOT EXISTS "client_accounts_isCurrentClient_idx" ON "client_accounts"("isCurrentClient");
CREATE UNIQUE INDEX IF NOT EXISTS "company_details_companyId_key" ON "company_details"("companyId");
CREATE INDEX IF NOT EXISTS "companies_source_idx" ON "companies"("source");
CREATE INDEX IF NOT EXISTS "companies_placeId_idx" ON "companies"("placeId");
CREATE UNIQUE INDEX IF NOT EXISTS "companies_source_externalId_key" ON "companies"("source", "externalId");
CREATE INDEX IF NOT EXISTS "lead_interactions_userId_idx" ON "lead_interactions"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'client_accounts_companyId_fkey'
      AND conrelid = 'client_accounts'::regclass
  ) THEN
    ALTER TABLE "client_accounts"
      ADD CONSTRAINT "client_accounts_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_assignedToId_fkey'
      AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_assignedToId_fkey"
      FOREIGN KEY ("assignedToId") REFERENCES "profiles"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'leads_assignedToId_legacy_fkey'
      AND conrelid = 'leads'::regclass
  ) THEN
    ALTER TABLE "leads"
      ADD CONSTRAINT "leads_assignedToId_legacy_fkey"
      FOREIGN KEY ("assignedToId_legacy") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_interactions_userId_fkey'
      AND conrelid = 'lead_interactions'::regclass
  ) THEN
    ALTER TABLE "lead_interactions"
      ADD CONSTRAINT "lead_interactions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "profiles"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'lead_interactions_userId_legacy_fkey'
      AND conrelid = 'lead_interactions'::regclass
  ) THEN
    ALTER TABLE "lead_interactions"
      ADD CONSTRAINT "lead_interactions_userId_legacy_fkey"
      FOREIGN KEY ("userId_legacy") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'company_details_companyId_fkey'
      AND conrelid = 'company_details'::regclass
  ) THEN
    ALTER TABLE "company_details"
      ADD CONSTRAINT "company_details_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
