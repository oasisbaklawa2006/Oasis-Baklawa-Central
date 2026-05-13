
-- Emergency INSERT bypass for users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'OASIS_AUTH_INSERT_BYPASS'
  ) THEN
    EXECUTE 'CREATE POLICY "OASIS_AUTH_INSERT_BYPASS" ON public.users FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;

-- Emergency INSERT bypass for companies table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'companies' AND policyname = 'OASIS_AUTH_INSERT_BYPASS'
  ) THEN
    EXECUTE 'CREATE POLICY "OASIS_AUTH_INSERT_BYPASS" ON public.companies FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;

-- Emergency INSERT bypass for profiles table (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'OASIS_AUTH_INSERT_BYPASS'
    ) THEN
      EXECUTE 'CREATE POLICY "OASIS_AUTH_INSERT_BYPASS" ON public.profiles FOR INSERT TO authenticated WITH CHECK (true)';
    END IF;
  END IF;
END $$;
