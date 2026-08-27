-- Commercial actions must not mutate the frozen discovery/import dataset.
-- This migration adds a B2B-link stage and a separate contact table for
-- representative-maintained commercial contact data.

ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'LINK_B2B_SENT';

DO $$
BEGIN
  CREATE TYPE "ContactType" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "ContactSource" AS ENUM ('IMPORT', 'PUBLIC', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "company_contacts" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "type" "ContactType" NOT NULL,
  "value" TEXT NOT NULL,
  "source" "ContactSource" NOT NULL DEFAULT 'MANUAL',
  "createdBy" UUID,
  "createdByLegacy" TEXT,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_contacts_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_contacts_companyId_type_value_key"
  ON "company_contacts"("companyId", "type", "value");

CREATE INDEX IF NOT EXISTS "company_contacts_companyId_idx"
  ON "company_contacts"("companyId");

CREATE INDEX IF NOT EXISTS "company_contacts_type_idx"
  ON "company_contacts"("type");

CREATE INDEX IF NOT EXISTS "company_contacts_source_idx"
  ON "company_contacts"("source");

CREATE INDEX IF NOT EXISTS "company_contacts_active_idx"
  ON "company_contacts"("active");
