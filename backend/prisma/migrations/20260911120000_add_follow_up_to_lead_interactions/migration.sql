-- Optional scheduling metadata for commercial interactions.
-- Existing interaction history remains valid because both columns are nullable.
ALTER TABLE "lead_interactions"
  ADD COLUMN IF NOT EXISTS "nextContactAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "followUpCompletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "lead_interactions_nextContactAt_followUpCompletedAt_idx"
  ON "lead_interactions"("nextContactAt", "followUpCompletedAt");

-- The backend may complete a follow-up without exposing this table to the
-- Supabase Data API. The policy created by the existing RLS migration remains
-- the authorization boundary.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deusa_app_user') THEN
    EXECUTE 'GRANT UPDATE ("followUpCompletedAt") ON TABLE public.lead_interactions TO deusa_app_user';
  END IF;
END $$;
