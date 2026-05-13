-- Fix: Add WITH CHECK to the admin products policy so INSERTs work
DROP POLICY "Admins manage products" ON public.products;

CREATE POLICY "Admins manage products"
ON public.products
FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]))
WITH CHECK (get_user_role(auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]));