-- Pillar 1: Relax INSERT RLS on orders & order_items so any authenticated buyer
-- with a company_id can submit. Read/update/delete policies remain scoped.

-- ORDERS: drop existing INSERT policies
DROP POLICY IF EXISTS "Buyers can insert their own company orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert their own company orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can insert orders with company" ON public.orders;

CREATE POLICY "Authenticated users can insert orders with company"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (company_id IS NOT NULL);

-- ORDER_ITEMS: drop existing INSERT policies
DROP POLICY IF EXISTS "Buyers insert own order_items" ON public.order_items;
DROP POLICY IF EXISTS "Authenticated users can insert order_items" ON public.order_items;

CREATE POLICY "Authenticated users can insert order_items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  order_id IN (SELECT id FROM public.orders WHERE company_id IS NOT NULL)
);
