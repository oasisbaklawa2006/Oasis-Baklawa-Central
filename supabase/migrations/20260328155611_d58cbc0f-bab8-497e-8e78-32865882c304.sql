
-- RLS: Sales execs can only see inward_material_advice for their assigned companies
-- First create a security definer function to check account manager
CREATE OR REPLACE FUNCTION public.is_account_manager(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies
    WHERE id = _company_id
      AND account_manager_id = _user_id
  )
$$;

-- Create a function to get user role without recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = _user_id LIMIT 1
$$;

-- Add RLS to client_interactions
ALTER TABLE public.client_interactions ENABLE ROW LEVEL SECURITY;

-- Sales execs see only their assigned companies' interactions
CREATE POLICY "Sales execs see own client interactions"
ON public.client_interactions
FOR SELECT
TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin', 'finance_head')
  OR public.is_account_manager(auth.uid(), company_id)
);

-- Sales execs can insert interactions for their companies
CREATE POLICY "Sales execs insert own client interactions"
ON public.client_interactions
FOR INSERT
TO authenticated
WITH CHECK (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
  OR public.is_account_manager(auth.uid(), company_id)
);

-- Add scoped SELECT policy for inward_material_advice for sales execs
-- First drop existing broad read policy
DROP POLICY IF EXISTS "Authenticated can read inward_material_advice" ON public.inward_material_advice;

-- Scoped read: admins see all, sales execs see only their companies
CREATE POLICY "Scoped read inward_material_advice"
ON public.inward_material_advice
FOR SELECT
TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin', 'finance_head', 'dispatch_head')
  OR public.is_account_manager(auth.uid(), company_id)
);
