-- ============ b2b_applications: lock down ============
DROP POLICY IF EXISTS "OASIS_ADMIN_FULL_CONTROL" ON public.b2b_applications;

CREATE POLICY "Applicants read own application"
  ON public.b2b_applications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff read all applications"
  ON public.b2b_applications FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Applicants insert own application"
  ON public.b2b_applications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Staff manage applications"
  ON public.b2b_applications FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff delete applications"
  ON public.b2b_applications FOR DELETE TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- ============ debug_webhooks: staff-only ============
DROP POLICY IF EXISTS "Authenticated can read debug_webhooks" ON public.debug_webhooks;
DROP POLICY IF EXISTS "Authenticated can insert debug_webhooks" ON public.debug_webhooks;

CREATE POLICY "Staff read debug_webhooks"
  ON public.debug_webhooks FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff insert debug_webhooks"
  ON public.debug_webhooks FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

-- ============ orders: drop unrestricted UPDATE ============
DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON public.orders;

-- ============ profiles: lock down if present ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE 'DROP POLICY IF EXISTS "OASIS_ADMIN_FULL_CONTROL" ON public.profiles';

    EXECUTE 'CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid())';
    EXECUTE 'CREATE POLICY "Staff read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()))';
    EXECUTE 'CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid())';
    -- Restrict self-update: prevent role/approval escalation by excluding those columns via trigger
    EXECUTE 'CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid())';
    EXECUTE 'CREATE POLICY "Staff manage profiles" ON public.profiles FOR ALL TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()))';
  END IF;
END $$;

-- Prevent privilege escalation on profiles.role / is_approved / status / price_tier by non-staff
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_internal_staff(auth.uid()) THEN
    RETURN NEW;
  END IF;

  -- Non-staff cannot change sensitive fields
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;
  IF to_jsonb(NEW) ? 'is_approved' AND (to_jsonb(NEW)->>'is_approved') IS DISTINCT FROM (to_jsonb(OLD)->>'is_approved') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('is_approved', to_jsonb(OLD)->'is_approved'));
  END IF;
  IF to_jsonb(NEW) ? 'status' AND (to_jsonb(NEW)->>'status') IS DISTINCT FROM (to_jsonb(OLD)->>'status') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('status', to_jsonb(OLD)->'status'));
  END IF;
  IF to_jsonb(NEW) ? 'price_tier' AND (to_jsonb(NEW)->>'price_tier') IS DISTINCT FROM (to_jsonb(OLD)->>'price_tier') THEN
    NEW := jsonb_populate_record(NEW, jsonb_build_object('price_tier', to_jsonb(OLD)->'price_tier'));
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='profiles') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_prevent_profile_priv_esc ON public.profiles';
    EXECUTE 'CREATE TRIGGER trg_prevent_profile_priv_esc BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation()';
  END IF;
END $$;