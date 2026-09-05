CREATE TABLE "company_location_audits" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "responsibleUserId" TEXT NOT NULL,
  "previousLatitude" DOUBLE PRECISION,
  "previousLongitude" DOUBLE PRECISION,
  "newLatitude" DOUBLE PRECISION NOT NULL,
  "newLongitude" DOUBLE PRECISION NOT NULL,
  "origin" TEXT NOT NULL DEFAULT 'MANUAL_MAP_ADJUSTMENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_location_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_location_audits_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "company_location_audits_companyId_createdAt_idx"
  ON "company_location_audits"("companyId", "createdAt");

CREATE INDEX "company_location_audits_responsibleUserId_idx"
  ON "company_location_audits"("responsibleUserId");

-- Keep the audit trail backend-only and append-only, matching the existing
-- Supabase/Data API posture without introducing permissive public policies.
ALTER TABLE "company_location_audits" ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE "company_location_audits" FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.company_location_audits FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL PRIVILEGES ON TABLE public.company_location_audits FROM authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deusa_app_user') THEN
    EXECUTE 'GRANT UPDATE (latitude, longitude, "origemCoordenada") ON TABLE public.companies TO deusa_app_user';
    EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_company_location ON public.companies';
    EXECUTE 'CREATE POLICY deusa_backend_update_company_location ON public.companies FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE public.company_location_audits TO deusa_app_user';
    EXECUTE 'CREATE POLICY deusa_backend_read ON public.company_location_audits FOR SELECT TO deusa_app_user USING (true)';
    EXECUTE 'CREATE POLICY deusa_backend_insert ON public.company_location_audits FOR INSERT TO deusa_app_user WITH CHECK (true)';
  END IF;
END $$;
