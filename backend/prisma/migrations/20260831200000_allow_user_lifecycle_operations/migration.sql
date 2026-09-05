-- Keep the frozen commercial dataset protected while allowing the backend to
-- execute explicitly authorized account lifecycle operations.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deusa_app_user') THEN
    RETURN;
  END IF;

  -- Invitation creation, resend and one-time password activation.
  EXECUTE 'GRANT SELECT, INSERT, UPDATE ("usedAt", "revokedAt") ON TABLE public.user_invitations TO deusa_app_user';
  EXECUTE 'ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_read ON public.user_invitations';
  EXECUTE 'CREATE POLICY deusa_backend_read ON public.user_invitations FOR SELECT TO deusa_app_user USING (true)';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_write_user_invitations ON public.user_invitations';
  EXECUTE 'CREATE POLICY deusa_backend_write_user_invitations ON public.user_invitations FOR INSERT TO deusa_app_user WITH CHECK (true)';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_user_invitations ON public.user_invitations';
  EXECUTE 'CREATE POLICY deusa_backend_update_user_invitations ON public.user_invitations FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';

  -- Deleting a user first removes only its assignment references and keeps
  -- the frozen leads and interaction history themselves intact.
  EXECUTE 'GRANT UPDATE ("assignedToId", "assignedToId_legacy") ON TABLE public.leads TO deusa_app_user';
  EXECUTE 'GRANT UPDATE ("userId_legacy") ON TABLE public.lead_interactions TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_leads ON public.leads';
  EXECUTE 'CREATE POLICY deusa_backend_update_leads ON public.leads FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_lead_interactions ON public.lead_interactions';
  EXECUTE 'CREATE POLICY deusa_backend_update_lead_interactions ON public.lead_interactions FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';
END $$;
