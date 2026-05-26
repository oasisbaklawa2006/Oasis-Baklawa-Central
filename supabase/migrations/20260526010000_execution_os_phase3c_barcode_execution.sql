-- Phase 3C: Barcode execution + append-only scan evidence.
-- No stock deduction, dispatch completion, finance, or customer exposure.

-- =============================================================================
-- operational_scan_records (append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operational_scan_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_type text NOT NULL,
  verification_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  order_id uuid NULL,
  queue_item_id uuid NULL REFERENCES public.operational_queue_items (id) ON DELETE RESTRICT,
  barcode_value text NOT NULL,
  expected_barcode text NULL,
  verification_status text NOT NULL,
  mismatch_reason text NULL,
  scan_source text NOT NULL,
  scan_device_id text NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  photo_evidence_url text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_scan_records_scan_type_check CHECK (
    scan_type IN (
      'order', 'carton', 'department_handoff', 'ready_goods_intake',
      'dispatch_gate', 'assembly_handoff'
    )
  ),
  CONSTRAINT operational_scan_records_verification_type_check CHECK (
    verification_type IN (
      'identity_match', 'gate_check', 'handoff_check', 'intake_check'
    )
  ),
  CONSTRAINT operational_scan_records_verification_status_check CHECK (
    verification_status IN (
      'scanned', 'verified', 'mismatch', 'duplicate', 'rejected', 'escalated'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_barcode_value
  ON public.operational_scan_records (barcode_value);

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_order_id
  ON public.operational_scan_records (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_queue_item_id
  ON public.operational_scan_records (queue_item_id)
  WHERE queue_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_verification_status
  ON public.operational_scan_records (verification_status);

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_created_at
  ON public.operational_scan_records (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_correlation_id
  ON public.operational_scan_records (correlation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_scan_records_idempotency_key
  ON public.operational_scan_records (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_scan_records_duplicate_window
  ON public.operational_scan_records (
    barcode_value, entity_type, entity_id, verification_type, created_at DESC
  );

-- Append-only enforcement (same pattern as operational_events)
CREATE OR REPLACE FUNCTION public.prevent_operational_scan_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'operational_scan_records are append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_scan_records_no_update ON public.operational_scan_records;
CREATE TRIGGER trg_operational_scan_records_no_update
  BEFORE UPDATE ON public.operational_scan_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_operational_scan_mutation();

DROP TRIGGER IF EXISTS trg_operational_scan_records_no_delete ON public.operational_scan_records;
CREATE TRIGGER trg_operational_scan_records_no_delete
  BEFORE DELETE ON public.operational_scan_records
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_operational_scan_mutation();

REVOKE UPDATE, DELETE ON public.operational_scan_records FROM authenticated, anon;

ALTER TABLE public.operational_scan_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read operational scan records" ON public.operational_scan_records;
CREATE POLICY "Staff read operational scan records"
  ON public.operational_scan_records FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert operational scan records" ON public.operational_scan_records;
CREATE POLICY "Staff insert operational scan records"
  ON public.operational_scan_records FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

COMMENT ON TABLE public.operational_scan_records IS
  'Phase 3C append-only barcode scan evidence. UPDATE/DELETE blocked by trigger and REVOKE.';
