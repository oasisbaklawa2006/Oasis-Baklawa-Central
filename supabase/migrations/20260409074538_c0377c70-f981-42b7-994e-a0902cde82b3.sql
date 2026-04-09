
-- ============================================
-- 1. PRODUCTS: Drop all, add single policy
-- ============================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'products' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.products', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OASIS_ADMIN_FULL_CONTROL" ON public.products
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 2. USERS: Drop all, add single policy
-- ============================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "OASIS_ADMIN_FULL_CONTROL" ON public.users
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 3. PROFILES: Drop all, add single policy
-- ============================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', r.policyname);
  END LOOP;
END $$;

-- profiles may not exist yet, so wrap in DO block
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles') THEN
    EXECUTE 'ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY';
    EXECUTE 'CREATE POLICY "OASIS_ADMIN_FULL_CONTROL" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- ============================================
-- 4. B2B_APPLICATIONS: Drop all, add admin + anon policies
-- ============================================
DO $$ 
DECLARE r RECORD;
BEGIN
  FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'b2b_applications' AND schemaname = 'public')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.b2b_applications', r.policyname);
  END LOOP;
END $$;

ALTER TABLE public.b2b_applications ENABLE ROW LEVEL SECURITY;

-- Authenticated users get full control
CREATE POLICY "OASIS_ADMIN_FULL_CONTROL" ON public.b2b_applications
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Anonymous users can submit applications
CREATE POLICY "ANON_CAN_SUBMIT_APPLICATION" ON public.b2b_applications
FOR INSERT TO anon
WITH CHECK (true);

-- ============================================
-- 5. Ensure b2b_applications in realtime publication
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'b2b_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE b2b_applications;
  END IF;
END $$;
