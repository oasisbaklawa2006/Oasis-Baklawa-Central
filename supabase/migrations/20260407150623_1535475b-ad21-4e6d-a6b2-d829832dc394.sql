
CREATE OR REPLACE FUNCTION public.is_staff_role(_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT upper(coalesce(_role, '')) = ANY (
    ARRAY[
      'SUPER_ADMIN', 'ADMIN',
      'FINANCE_HEAD', 'FINANCE_EXEC',
      'OPERATIONS_MANAGER', 'PRODUCTION_MANAGER',
      'HOD_ARABIC', 'HOD_FUSION', 'HOD_CHOCOLATE', 'HOD_DRAGEES', 'HOD_BAKERY', 'HOD_NUTS', 'HOD_ASSEMBLY',
      'STORE_INCHARGE', 'DISPATCH_MANAGER', 'DISPATCH_INCHARGE', 'SECURITY_CONTROL',
      'SALES_EXECUTIVE', 'SUPPORT_EXECUTIVE',
      'GATE_SECURITY', 'STORE_READY_GOODS', 'RGS_ADMIN', 'STORE_3RD_PARTY',
      'ASSEMBLY_MANAGER', 'PACKING_SUPERVISOR', 'DISPATCH_HEAD',
      'PROD_ARABIC_SWEETS', 'PROD_CHOCOLATE', 'PROD_DRAGEES', 'PROD_FUSION', 'PROD_BAKERY', 'PROD_NUTS'
    ]
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT upper(r.role_key) FROM public.user_role_map urm JOIN public.roles r ON r.id = urm.role_id WHERE urm.user_id = _user_id LIMIT 1),
    (SELECT upper(role) FROM public.users WHERE id = _user_id LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT public.is_staff_role(public.get_user_role(_user_id))
$$;
