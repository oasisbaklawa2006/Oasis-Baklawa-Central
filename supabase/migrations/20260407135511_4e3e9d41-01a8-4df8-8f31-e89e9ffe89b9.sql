
-- ============================================
-- 1. ENABLE RLS ON ALL UNPROTECTED TABLES
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.b2b_applications ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. DROP DANGEROUS OPEN POLICIES
-- ============================================
DROP POLICY IF EXISTS "Unrestricted audit access" ON public.audit_logs;
DROP POLICY IF EXISTS "Unrestricted role map access" ON public.user_role_map;
DROP POLICY IF EXISTS "Flat read access for users" ON public.users;

-- ============================================
-- 3. FIX USERS TABLE — replace self-referencing policies
-- ============================================
-- Drop old admin policies that will cause infinite recursion
DROP POLICY IF EXISTS "Admins can delete users" ON public.users;
DROP POLICY IF EXISTS "Admins can insert users" ON public.users;
DROP POLICY IF EXISTS "Admins can update users" ON public.users;

-- Recreate with get_user_role() to avoid recursion
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

CREATE POLICY "Internal staff can read all users"
  ON public.users FOR SELECT TO authenticated
  USING (is_internal_staff(auth.uid()));

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

CREATE POLICY "Admins can delete users"
  ON public.users FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

-- Allow the handle_new_user trigger to insert (it runs as SECURITY DEFINER so bypasses RLS)
-- Keep existing self-scoped policies (Users can read own data, Users can update own record, etc.)

-- ============================================
-- 4. FIX PROFILES TABLE — scope policies
-- ============================================
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.profiles;

CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

CREATE POLICY "Internal staff read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (is_internal_staff(auth.uid()));

-- Allow authenticated insert for profile creation (trigger/signup flow)
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

-- ============================================
-- 5. FIX COMPANIES TABLE — prevent recursion
-- ============================================
DROP POLICY IF EXISTS "Admins manage companies" ON public.companies;

CREATE POLICY "Admins manage companies"
  ON public.companies FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

-- ============================================
-- 6. FIX B2B_APPLICATIONS — prevent recursion
-- ============================================
DROP POLICY IF EXISTS "Only admins can view or process applications" ON public.b2b_applications;

CREATE POLICY "Admins can manage applications"
  ON public.b2b_applications FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

-- Applicants can view their own application
CREATE POLICY "Users can view own application"
  ON public.b2b_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- 7. FIX STORAGE — trade-documents bucket
-- ============================================
DROP POLICY IF EXISTS "Anyone can upload trade documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public access to trade_documents" ON storage.objects;
