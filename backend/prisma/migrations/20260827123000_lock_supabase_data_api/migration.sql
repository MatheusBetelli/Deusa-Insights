-- Backend-only Supabase posture.
-- The frontend talks to NestJS, not directly to Supabase/PostgREST. Keep the
-- Data API roles without table privileges and let the backend enforce JWT/RBAC.

DO $$
DECLARE
  app_table TEXT;
  app_tables TEXT[] := ARRAY[
    'users',
    'user_mappings',
    'profiles',
    'cities',
    'cnaes',
    'companies',
    'company_cnaes',
    'client_accounts',
    'leads',
    'lead_interactions',
    'import_jobs',
    'company_details',
    'company_contacts'
  ];
BEGIN
  FOREACH app_table IN ARRAY app_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon', app_table);
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM authenticated', app_table);
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE USAGE ON SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
  END IF;
END $$;

DO $$
DECLARE
  app_table TEXT;
  app_tables TEXT[] := ARRAY[
    'users',
    'user_mappings',
    'profiles',
    'cities',
    'cnaes',
    'companies',
    'company_cnaes',
    'client_accounts',
    'leads',
    'lead_interactions',
    'import_jobs',
    'company_details',
    'company_contacts'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deusa_app_user') THEN
    RETURN;
  END IF;

  EXECUTE format('GRANT CONNECT ON DATABASE %I TO deusa_app_user', current_database());
  EXECUTE 'GRANT USAGE ON SCHEMA public TO deusa_app_user';

  FOREACH app_table IN ARRAY app_tables LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO deusa_app_user', app_table);
    EXECUTE format('DROP POLICY IF EXISTS deusa_backend_read ON public.%I', app_table);
    EXECUTE format(
      'CREATE POLICY deusa_backend_read ON public.%I FOR SELECT TO deusa_app_user USING (true)',
      app_table
    );
  END LOOP;

  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.users TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_write_users ON public.users';
  EXECUTE 'CREATE POLICY deusa_backend_write_users ON public.users FOR ALL TO deusa_app_user USING (true) WITH CHECK (true)';

  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.profiles TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_write_profiles ON public.profiles';
  EXECUTE 'CREATE POLICY deusa_backend_write_profiles ON public.profiles FOR ALL TO deusa_app_user USING (true) WITH CHECK (true)';

  EXECUTE 'GRANT INSERT, UPDATE, DELETE ON TABLE public.user_mappings TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_write_user_mappings ON public.user_mappings';
  EXECUTE 'CREATE POLICY deusa_backend_write_user_mappings ON public.user_mappings FOR ALL TO deusa_app_user USING (true) WITH CHECK (true)';

  EXECUTE 'GRANT UPDATE (status, notes, "lastContactAt", "nextActionAt", "updatedAt") ON TABLE public.leads TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_leads ON public.leads';
  EXECUTE 'CREATE POLICY deusa_backend_update_leads ON public.leads FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';

  EXECUTE 'GRANT INSERT ON TABLE public.lead_interactions TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_insert_lead_interactions ON public.lead_interactions';
  EXECUTE 'CREATE POLICY deusa_backend_insert_lead_interactions ON public.lead_interactions FOR INSERT TO deusa_app_user WITH CHECK (true)';

  EXECUTE 'GRANT INSERT, UPDATE (value, "isPrimary", active, "updatedAt") ON TABLE public.company_contacts TO deusa_app_user';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_insert_company_contacts ON public.company_contacts';
  EXECUTE 'DROP POLICY IF EXISTS deusa_backend_update_company_contacts ON public.company_contacts';
  EXECUTE 'CREATE POLICY deusa_backend_insert_company_contacts ON public.company_contacts FOR INSERT TO deusa_app_user WITH CHECK (true)';
  EXECUTE 'CREATE POLICY deusa_backend_update_company_contacts ON public.company_contacts FOR UPDATE TO deusa_app_user USING (true) WITH CHECK (true)';

  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO deusa_app_user';
END $$;
