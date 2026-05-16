-- 1) STARTER PACKS TABLE
CREATE TABLE IF NOT EXISTS public.starter_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tier text NOT NULL,
  description text,
  estimated_investment numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.starter_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read active starter packs"
  ON public.starter_packs FOR SELECT TO authenticated
  USING (is_active = true OR is_internal_staff(auth.uid()));

CREATE POLICY "Admins manage starter packs"
  ON public.starter_packs FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']))
  WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin','super_admin']));

CREATE OR REPLACE FUNCTION public.touch_starter_packs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_starter_packs_updated_at
BEFORE UPDATE ON public.starter_packs
FOR EACH ROW EXECUTE FUNCTION public.touch_starter_packs_updated_at();

-- Seed 3 default packs (admin can edit items later)
INSERT INTO public.starter_packs (name, tier, description, estimated_investment, sort_order, items) VALUES
  ('Basic Starter Pack',   'basic',   'Curated entry assortment for first-time partners.', 15000, 1, '[]'::jsonb),
  ('Smart Starter Pack',   'smart',   'Best-seller mix balancing margin and turnover.',    35000, 2, '[]'::jsonb),
  ('Premium Starter Pack', 'premium', 'Flagship hampers and premium SKUs for hero shelves.',75000, 3, '[]'::jsonb)
ON CONFLICT DO NOTHING;

-- 2) PROFILE CHANGE REQUESTS
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  requested_by uuid REFERENCES auth.users(id),
  field_name text NOT NULL,
  current_value text,
  requested_value text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  admin_notes text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers insert own company change requests"
  ON public.profile_change_requests FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
    AND requested_by = auth.uid()
  );

CREATE POLICY "Buyers read own company change requests"
  ON public.profile_change_requests FOR SELECT TO authenticated
  USING (
    company_id = (SELECT u.company_id FROM users u WHERE u.id = auth.uid() LIMIT 1)
    OR is_internal_staff(auth.uid())
  );

CREATE POLICY "Staff manage change requests"
  ON public.profile_change_requests FOR ALL TO authenticated
  USING (is_internal_staff(auth.uid()))
  WITH CHECK (is_internal_staff(auth.uid()));

-- 3) CREDIT LIMIT CLAMP (>= 0)
ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_credit_limit_nonneg;
ALTER TABLE public.companies
  ADD CONSTRAINT companies_credit_limit_nonneg CHECK (credit_limit IS NULL OR credit_limit >= 0);

-- 4) SYSTEM-MANAGED is_frozen GUARD
CREATE OR REPLACE FUNCTION public.guard_is_frozen_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_frozen IS DISTINCT FROM OLD.is_frozen THEN
    IF NOT public.is_internal_staff(auth.uid()) THEN
      RAISE EXCEPTION 'is_frozen is system-managed. Use manual_unlock_credit RPC or month-end lock job.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_is_frozen ON public.companies;
CREATE TRIGGER trg_guard_is_frozen
BEFORE UPDATE OF is_frozen ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.guard_is_frozen_changes();