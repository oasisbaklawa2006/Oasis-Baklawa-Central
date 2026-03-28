CREATE TABLE IF NOT EXISTS public.archive_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type text,
  actor_id uuid,
  module_name text,
  entity_name text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  reason text,
  risk_level text DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.archive_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage archive_logs"
ON public.archive_logs FOR ALL TO authenticated
USING (get_user_role(auth.uid()) IN ('admin', 'super_admin'));

CREATE POLICY "Authenticated insert archive_logs"
ON public.archive_logs FOR INSERT TO authenticated
WITH CHECK (true);