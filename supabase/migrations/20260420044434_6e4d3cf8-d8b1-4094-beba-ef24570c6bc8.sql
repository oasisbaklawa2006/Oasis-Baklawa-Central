-- Relax orders INSERT policy: any authenticated user with a non-null company_id may insert.
DROP POLICY IF EXISTS "Buyers and staff insert orders" ON public.orders;

CREATE POLICY "Authenticated users can insert orders with company"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (company_id IS NOT NULL);

-- Order items: ensure inserts allowed for any draft/active order with a company_id (already present, recreate to confirm)
DROP POLICY IF EXISTS "Authenticated users can insert order_items" ON public.order_items;

CREATE POLICY "Authenticated users can insert order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (SELECT id FROM public.orders WHERE company_id IS NOT NULL)
);