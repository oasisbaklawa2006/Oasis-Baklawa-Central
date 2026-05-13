
-- WhatsApp API configuration table for Click2API
CREATE TABLE public.whatsapp_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key text NOT NULL,
  instance_id text NOT NULL,
  webhook_secret text,
  default_country_code text DEFAULT '+91',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp_config"
  ON public.whatsapp_config FOR ALL
  TO authenticated
  USING (get_user_role(auth.uid()) = ANY(ARRAY['ADMIN','SUPER_ADMIN']));

CREATE POLICY "Authenticated read whatsapp_config"
  ON public.whatsapp_config FOR SELECT
  TO authenticated
  USING (true);
