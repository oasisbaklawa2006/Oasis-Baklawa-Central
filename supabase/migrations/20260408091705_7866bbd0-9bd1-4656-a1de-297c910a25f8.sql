
-- PRODUCTS: Drop and recreate
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
DROP POLICY IF EXISTS "Anyone authenticated reads products" ON public.products;
DROP POLICY IF EXISTS "Internal staff can view products" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Public reads active products" ON public.products;
DROP POLICY IF EXISTS "authenticated can read products" ON public.products;
DROP POLICY IF EXISTS "authenticated users can view products" ON public.products;

CREATE POLICY "OASIS_AUTHENTICATED_FULL_ACCESS" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- CATEGORIES: Drop and recreate
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
DROP POLICY IF EXISTS "Authenticated can read categories" ON public.categories;

CREATE POLICY "OASIS_AUTHENTICATED_FULL_ACCESS" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STATUS REGRESSION GUARD
CREATE OR REPLACE FUNCTION public.prevent_order_status_regression()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  locked_statuses text[] := ARRAY['approved','awaiting_advance','in_production','manufacturing','assembly','assembled','packing','partial_ready','packed_ready','awaiting_final_payment','awaiting_payment','cleared_for_dispatch','dispatched','in_transit','delivered','closed'];
BEGIN
  IF OLD.status = ANY(locked_statuses) AND NEW.status IN ('draft','cart') THEN
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_order_status_regression ON public.orders;
CREATE TRIGGER guard_order_status_regression BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.prevent_order_status_regression();
