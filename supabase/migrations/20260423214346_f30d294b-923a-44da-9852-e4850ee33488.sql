CREATE TABLE IF NOT EXISTS public.auth_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text,
  phone text,
  channel text,
  status text,
  request_id text,
  description text,
  raw_payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.auth_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_phone ON public.auth_logs (phone);

ALTER TABLE public.auth_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view auth logs"
ON public.auth_logs
FOR SELECT
TO authenticated
USING (public.is_internal_staff(auth.uid()));