CREATE TABLE public.system_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  priority text DEFAULT 'normal',
  expires_at timestamp with time zone,
  target_role text,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read system_alerts"
  ON public.system_alerts FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage system_alerts"
  ON public.system_alerts FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','super_admin')
  ));