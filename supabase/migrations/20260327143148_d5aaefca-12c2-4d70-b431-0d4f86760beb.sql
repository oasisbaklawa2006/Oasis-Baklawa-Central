ALTER TABLE public.factory_holidays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage factory_holidays"
ON public.factory_holidays
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
));

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage system_settings"
ON public.system_settings
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
))
WITH CHECK (EXISTS (
  SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
));

CREATE POLICY "Authenticated can read system_settings"
ON public.system_settings
FOR SELECT
TO authenticated
USING (true);