-- Phase 24I: DISPATCH_HEAD is internal staff (explicit on 4D/4E policies) but was omitted from is_internal_staff().
-- Narrow fix: add DISPATCH_HEAD so governed inventory_reservations / inventory_movements writes succeed for dispatch operators.

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
      AND upper(role) = ANY (ARRAY[
        'SUPER_ADMIN', 'ADMIN', 'FINANCE_HEAD', 'FINANCE_EXEC',
        'OPERATIONS_MANAGER', 'PRODUCTION_MANAGER',
        'HOD_ARABIC', 'HOD_FUSION', 'HOD_CHOCOLATE', 'HOD_BAKERY', 'HOD_NUTS', 'HOD_ASSEMBLY',
        'STORE_INCHARGE', 'DISPATCH_MANAGER', 'DISPATCH_INCHARGE', 'DISPATCH_HEAD', 'SECURITY_CONTROL',
        'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE'
      ])
  )
$$;

COMMENT ON FUNCTION public.is_internal_staff(uuid) IS
  'True when user is internal staff. Includes DISPATCH_HEAD (24I) for inventory governance RLS.';
