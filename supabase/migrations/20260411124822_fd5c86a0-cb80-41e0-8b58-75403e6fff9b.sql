
CREATE TABLE public.debug_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL DEFAULT 'inbound',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  phone_number text,
  error_message text,
  processed boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.debug_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read debug_webhooks"
ON public.debug_webhooks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert debug_webhooks"
ON public.debug_webhooks FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role full access debug_webhooks"
ON public.debug_webhooks FOR ALL TO service_role
USING (true) WITH CHECK (true);
