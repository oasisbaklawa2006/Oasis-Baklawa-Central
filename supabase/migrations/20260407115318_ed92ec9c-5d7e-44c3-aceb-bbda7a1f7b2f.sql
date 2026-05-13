-- Update is_staff_role to include HOD_DRAGEES
CREATE OR REPLACE FUNCTION public.is_staff_role(_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT upper(coalesce(_role, '')) = ANY (
    ARRAY[
      'SUPER_ADMIN',
      'ADMIN',
      'FINANCE_HEAD',
      'FINANCE_EXEC',
      'OPERATIONS_MANAGER',
      'PRODUCTION_MANAGER',
      'HOD_ARABIC',
      'HOD_FUSION',
      'HOD_CHOCOLATE',
      'HOD_DRAGEES',
      'HOD_BAKERY',
      'HOD_NUTS',
      'HOD_ASSEMBLY',
      'STORE_INCHARGE',
      'DISPATCH_MANAGER',
      'DISPATCH_INCHARGE',
      'SECURITY_CONTROL'
    ]
  );
$function$;

-- Update is_internal_staff to include HOD_DRAGEES
CREATE OR REPLACE FUNCTION public.is_internal_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = _user_id
      AND upper(role) = ANY (ARRAY[
        'SUPER_ADMIN', 'ADMIN', 'FINANCE_HEAD', 'FINANCE_EXEC',
        'OPERATIONS_MANAGER', 'PRODUCTION_MANAGER',
        'HOD_ARABIC', 'HOD_FUSION', 'HOD_CHOCOLATE', 'HOD_DRAGEES', 'HOD_BAKERY', 'HOD_NUTS', 'HOD_ASSEMBLY',
        'STORE_INCHARGE', 'DISPATCH_MANAGER', 'DISPATCH_INCHARGE', 'SECURITY_CONTROL',
        'SUPPORT_EXECUTIVE', 'SALES_EXECUTIVE'
      ])
  )
$function$;