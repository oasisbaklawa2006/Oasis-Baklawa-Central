-- Phase 4.1: Sales Executive roster hardening
-- Roster authority: public.companies.account_manager_id

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =========================
-- companies (SELECT scoping)
-- =========================
DROP POLICY IF EXISTS "Authenticated can read companies" ON public.companies;
DROP POLICY IF EXISTS "Staff read all companies" ON public.companies;
DROP POLICY IF EXISTS "Sales executives read assigned companies" ON public.companies;
DROP POLICY IF EXISTS "Buyers read own companies" ON public.companies;

CREATE POLICY "Staff read all companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
);

CREATE POLICY "Sales executives read assigned companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  public.is_account_manager(auth.uid(), id)
);

CREATE POLICY "Buyers read own companies"
ON public.companies
FOR SELECT
TO authenticated
USING (
  id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
);

-- ======================
-- orders (SELECT scoping)
-- ======================
DROP POLICY IF EXISTS "Authenticated can read orders" ON public.orders;
DROP POLICY IF EXISTS "Staff read all orders" ON public.orders;
DROP POLICY IF EXISTS "Sales executives read assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Buyers read own orders" ON public.orders;

CREATE POLICY "Staff read all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
);

CREATE POLICY "Sales executives read assigned orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  public.is_account_manager(auth.uid(), company_id)
);

CREATE POLICY "Buyers read own orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
);

-- ===========================
-- order_items (SELECT scoping)
-- ===========================
DROP POLICY IF EXISTS "Staff full access order_items" ON public.order_items;
DROP POLICY IF EXISTS "Sales executives read assigned order_items" ON public.order_items;

-- Keep broad item management for staff except sales executives.
CREATE POLICY "Staff full access order_items"
ON public.order_items
FOR ALL
TO authenticated
USING (
  public.is_internal_staff(auth.uid())
  AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
)
WITH CHECK (
  public.is_internal_staff(auth.uid())
  AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
);

CREATE POLICY "Sales executives read assigned order_items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = order_items.order_id
      AND public.is_account_manager(auth.uid(), o.company_id)
  )
);
