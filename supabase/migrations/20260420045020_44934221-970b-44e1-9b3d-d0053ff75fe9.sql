-- Fix: allow buyers to transition their draft orders to submitted/awaiting_advance/etc.
DROP POLICY IF EXISTS "Buyers update own draft orders" ON public.orders;

CREATE POLICY "Buyers update own draft orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  status = 'draft'
  AND company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
)
WITH CHECK (
  company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
);