-- Dual-role clarity: ensure highest-privilege role wins when a user has multiple roles
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (
      SELECT upper(r.role_key)
      FROM public.user_role_map urm
      JOIN public.roles r ON r.id = urm.role_id
      WHERE urm.user_id = _user_id
      ORDER BY
        CASE upper(r.role_key)
          WHEN 'SUPER_ADMIN' THEN 1
          WHEN 'ADMIN' THEN 2
          WHEN 'FINANCE_HEAD' THEN 3
          WHEN 'OPERATIONS_MANAGER' THEN 4
          WHEN 'PRODUCTION_MANAGER' THEN 5
          WHEN 'FINANCE_EXEC' THEN 6
          WHEN 'DISPATCH_MANAGER' THEN 7
          WHEN 'STORE_INCHARGE' THEN 8
          WHEN 'SUPPORT_EXECUTIVE' THEN 9
          WHEN 'SALES_EXECUTIVE' THEN 10
          ELSE 99
        END
      LIMIT 1
    ),
    (SELECT upper(role) FROM public.users WHERE id = _user_id LIMIT 1)
  )
$function$;