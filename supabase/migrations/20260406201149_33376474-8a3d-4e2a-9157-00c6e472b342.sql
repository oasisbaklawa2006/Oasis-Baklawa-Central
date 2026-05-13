
-- Drop existing duplicate policy first
DROP POLICY IF EXISTS "Admins manage products" ON public.products;

-- Re-create it with security definer function
CREATE POLICY "Admins manage products"
  ON public.products FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Products: authenticated reads
CREATE POLICY "Anyone authenticated reads products"
  ON public.products FOR SELECT TO authenticated
  USING (true);

-- Products: anon reads active
CREATE POLICY "Public reads active products"
  ON public.products FOR SELECT TO anon
  USING (is_active = true);

-- user_role_map: users read own
CREATE POLICY "Users read own role mapping"
  ON public.user_role_map FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Orders: staff update
CREATE POLICY "Staff can update all orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Orders: buyers update own drafts
CREATE POLICY "Buyers update own draft orders"
  ON public.orders FOR UPDATE TO authenticated
  USING (
    status = 'draft'
    AND company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
  );

-- Order payments: staff manage
CREATE POLICY "Staff manage order payments"
  ON public.order_payments FOR ALL TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin'));

-- Order payments: buyers read own
CREATE POLICY "Buyers read own company payments"
  ON public.order_payments FOR SELECT TO authenticated
  USING (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1));

-- Order payments: buyers insert own
CREATE POLICY "Buyers insert own company payments"
  ON public.order_payments FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1));

-- Fix recalculate function search_path
CREATE OR REPLACE FUNCTION public.recalculate_erp_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $function$
DECLARE
  calc_subtotal NUMERIC := 0;
  calc_total NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(oi.quantity * p.price_per_kg), 0)
  INTO calc_subtotal
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.order_id;

  calc_total := calc_subtotal * 1.18;

  UPDATE public.orders
  SET 
    sales_order_value = calc_total,
    advance_required = calc_total * 0.5
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$function$;

-- Storage fixes
DROP POLICY IF EXISTS "Anon can upload trade documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can read trade documents" ON storage.objects;

CREATE POLICY "Users read own trade documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Staff read all trade documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'trade-documents' AND (public.is_internal_staff(auth.uid()) OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin')));

CREATE POLICY "Authenticated upload own trade documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'trade-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Update is_internal_staff with all 18 staff roles
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id
      AND upper(role) = ANY (ARRAY[
        'SUPER_ADMIN', 'ADMIN', 'FINANCE_HEAD', 'FINANCE_EXEC',
        'OPERATIONS_MANAGER', 'PRODUCTION_MANAGER',
        'HOD_ARABIC', 'HOD_FUSION', 'HOD_CHOCOLATE', 'HOD_BAKERY', 'HOD_NUTS', 'HOD_ASSEMBLY',
        'STORE_INCHARGE', 'DISPATCH_MANAGER', 'DISPATCH_INCHARGE', 'SECURITY_CONTROL',
        'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE'
      ])
  )
$function$;
