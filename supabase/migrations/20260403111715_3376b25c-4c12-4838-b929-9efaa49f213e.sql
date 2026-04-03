
-- Create a security definer function to check if user is internal staff
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id
      AND role IN (
        'super_admin', 'admin', 'finance_head', 'dispatch_head',
        'production_manager', 'assembly_manager', 'packing_supervisor',
        'support_executive', 'store_ready_goods', 'store_3rd_party',
        'gate_security', 'sales_executive',
        'prod_arabic_sweets', 'prod_chocolate', 'prod_fusion',
        'prod_bakery', 'prod_nuts'
      )
  )
$$;

-- Allow internal staff to SELECT orders
CREATE POLICY "Internal staff can view all orders"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));

-- Allow internal staff to SELECT order_items
CREATE POLICY "Internal staff can view all order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));

-- Allow internal staff to SELECT products (needed for TV module joins)
CREATE POLICY "Internal staff can view products"
ON public.products
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));
