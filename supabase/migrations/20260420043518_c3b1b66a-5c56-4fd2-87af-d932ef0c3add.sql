
-- Tighten orders INSERT policy: scope to user's own company_id, allow staff bypass
DROP POLICY IF EXISTS "Authenticated users can insert orders with company" ON public.orders;

CREATE POLICY "Buyers and staff insert orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  company_id IS NOT NULL
  AND (
    is_internal_staff(auth.uid())
    OR company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
  )
);
