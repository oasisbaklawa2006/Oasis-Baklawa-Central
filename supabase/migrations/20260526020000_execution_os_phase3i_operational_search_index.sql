-- Phase 3I: Persistent operational search index (internal staff only).
-- No customer/public access, no DELETE from UI, no external search service.

CREATE TABLE IF NOT EXISTS public.operational_search_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  order_id uuid NULL,
  customer_id uuid NULL,
  queue_item_id uuid NULL REFERENCES public.operational_queue_items (id) ON DELETE RESTRICT,
  scan_record_id uuid NULL REFERENCES public.operational_scan_records (id) ON DELETE RESTRICT,
  event_id uuid NULL REFERENCES public.operational_events (id) ON DELETE RESTRICT,
  public_ref text NULL,
  search_title text NOT NULL,
  search_subtitle text NULL,
  search_body text NULL,
  normalized_tokens text[] NOT NULL DEFAULT '{}',
  aliases text[] NOT NULL DEFAULT '{}',
  barcode_values text[] NOT NULL DEFAULT '{}',
  so_numbers text[] NOT NULL DEFAULT '{}',
  phone_tokens text[] NOT NULL DEFAULT '{}',
  email_tokens text[] NOT NULL DEFAULT '{}',
  department text NULL,
  visibility text NOT NULL DEFAULT 'internal',
  sensitivity text NOT NULL DEFAULT 'normal',
  source text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_search_index_visibility_check CHECK (
    visibility IN ('internal', 'staff_scoped', 'customer_safe_candidate')
  ),
  CONSTRAINT operational_search_index_sensitivity_check CHECK (
    sensitivity IN ('normal', 'restricted', 'confidential')
  ),
  CONSTRAINT operational_search_index_entity_source_unique UNIQUE (entity_type, entity_id, source)
);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_normalized_tokens
  ON public.operational_search_index USING gin (normalized_tokens);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_aliases
  ON public.operational_search_index USING gin (aliases);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_barcode_values
  ON public.operational_search_index USING gin (barcode_values);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_so_numbers
  ON public.operational_search_index USING gin (so_numbers);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_order_id
  ON public.operational_search_index (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_customer_id
  ON public.operational_search_index (customer_id)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_queue_item_id
  ON public.operational_search_index (queue_item_id)
  WHERE queue_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_scan_record_id
  ON public.operational_search_index (scan_record_id)
  WHERE scan_record_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_event_id
  ON public.operational_search_index (event_id)
  WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_entity_type
  ON public.operational_search_index (entity_type);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_department
  ON public.operational_search_index (department)
  WHERE department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_search_index_visibility
  ON public.operational_search_index (visibility);

CREATE INDEX IF NOT EXISTS idx_operational_search_index_updated_at
  ON public.operational_search_index (updated_at DESC);

ALTER TABLE public.operational_search_index ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read operational search index" ON public.operational_search_index;
CREATE POLICY "Staff read operational search index"
  ON public.operational_search_index FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert operational search index" ON public.operational_search_index;
CREATE POLICY "Staff insert operational search index"
  ON public.operational_search_index FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update operational search index" ON public.operational_search_index;
CREATE POLICY "Staff update operational search index"
  ON public.operational_search_index FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

-- No DELETE policy — index entries are upserted/stale-marked only via repository contract.

REVOKE DELETE ON public.operational_search_index FROM authenticated, anon;

COMMENT ON TABLE public.operational_search_index IS
  'Phase 3I governed operational search index. Internal staff only; no customer/public search.';
