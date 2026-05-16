
-- Fix RLS disabled on invoices and notifications
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage invoices" ON public.invoices FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')));
CREATE POLICY "Authenticated read invoices" ON public.invoices FOR SELECT TO authenticated USING (true);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read notifications" ON public.notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')));

-- Fix order_status_history
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read order_status_history" ON public.order_status_history FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert order_status_history" ON public.order_status_history FOR INSERT TO authenticated WITH CHECK (true);

-- Fix handle_new_user search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
begin
  insert into public.users (id, email, name, role)
  values (new.id, new.email, new.email, 'customer_user');
  return new;
end;
$function$;
