
-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================================
-- 1. WHATSAPP_BUFFER
-- =========================================
CREATE TABLE IF NOT EXISTS public.whatsapp_buffer (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_phone text NOT NULL,
  sender_name text,
  message_type text DEFAULT 'text',
  text_content text,
  media_url text,
  media_mime_type text,
  raw_payload jsonb,
  webhook_id uuid,
  bundle_status text NOT NULL DEFAULT 'pending', -- pending | flushing | flushed | failed
  flushed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_sender ON public.whatsapp_buffer(sender_phone, created_at);
CREATE INDEX IF NOT EXISTS idx_whatsapp_buffer_status ON public.whatsapp_buffer(bundle_status);

ALTER TABLE public.whatsapp_buffer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access whatsapp_buffer"
  ON public.whatsapp_buffer FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Staff read whatsapp_buffer"
  ON public.whatsapp_buffer FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Staff insert whatsapp_buffer"
  ON public.whatsapp_buffer FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

-- =========================================
-- 2. SHADOW_CLIENTS
-- =========================================
CREATE TABLE IF NOT EXISTS public.shadow_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_phone text NOT NULL,
  sender_name text,
  extracted_business_name text,
  extracted_gst text,
  extracted_address text,
  extracted_contact_email text,
  status text NOT NULL DEFAULT 'awaiting_details', -- awaiting_details | promoted | rejected
  promoted_to_company_id uuid,
  notes text,
  last_prompt_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shadow_clients_phone ON public.shadow_clients(sender_phone);
CREATE INDEX IF NOT EXISTS idx_shadow_clients_status ON public.shadow_clients(status);

ALTER TABLE public.shadow_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access shadow_clients"
  ON public.shadow_clients FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Staff read shadow_clients"
  ON public.shadow_clients FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Ops manage shadow_clients"
  ON public.shadow_clients FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = ANY (ARRAY['ADMIN','SUPER_ADMIN','OPERATIONS_MANAGER']))
  WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['ADMIN','SUPER_ADMIN','OPERATIONS_MANAGER']));

-- =========================================
-- 3. SUGGESTED_ORDERS (Central Pool)
-- =========================================
CREATE TABLE IF NOT EXISTS public.suggested_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_phone text NOT NULL,
  sender_name text,
  matched_company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  shadow_client_id uuid REFERENCES public.shadow_clients(id) ON DELETE SET NULL,
  extracted_business_name text,
  extracted_items jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ product_name, quantity, unit, notes }]
  extracted_delivery_date date,
  extracted_notes text,
  source_image_url text,
  source_text text,
  source_message_ids uuid[] DEFAULT '{}',
  ai_confidence numeric DEFAULT 0,
  ai_model text,
  status text NOT NULL DEFAULT 'pending_review', -- pending_review | confirmed | rejected | needs_clarification
  reviewed_by uuid,
  reviewed_at timestamptz,
  promoted_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_suggested_orders_status ON public.suggested_orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_suggested_orders_company ON public.suggested_orders(matched_company_id);

ALTER TABLE public.suggested_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access suggested_orders"
  ON public.suggested_orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Ops read suggested_orders"
  ON public.suggested_orders FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = ANY (ARRAY['ADMIN','SUPER_ADMIN','OPERATIONS_MANAGER']));

CREATE POLICY "Ops manage suggested_orders"
  ON public.suggested_orders FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = ANY (ARRAY['ADMIN','SUPER_ADMIN','OPERATIONS_MANAGER']))
  WITH CHECK (public.get_user_role(auth.uid()) = ANY (ARRAY['ADMIN','SUPER_ADMIN','OPERATIONS_MANAGER']));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_suggested_orders_touch ON public.suggested_orders;
CREATE TRIGGER trg_suggested_orders_touch BEFORE UPDATE ON public.suggested_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_shadow_clients_touch ON public.shadow_clients;
CREATE TRIGGER trg_shadow_clients_touch BEFORE UPDATE ON public.shadow_clients
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================================
-- 4. CRON JOB: Flush buffer every 30s
-- =========================================
DO $$
BEGIN
  PERFORM cron.unschedule('banyan-flush-buffer');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'banyan-flush-buffer',
  '*/30 * * * * *',  -- every 30 seconds
  $$
  SELECT net.http_post(
    url := 'https://tcxvcatsqqertcnycuop.supabase.co/functions/v1/banyan-central-parser',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{"trigger":"cron"}'::jsonb
  );
  $$
);
