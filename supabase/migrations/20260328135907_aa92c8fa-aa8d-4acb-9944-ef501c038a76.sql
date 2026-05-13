ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notification_events"
ON public.notification_events
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users u
  WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
));

CREATE POLICY "Authenticated can read notification_events"
ON public.notification_events
FOR SELECT
TO authenticated
USING (true);