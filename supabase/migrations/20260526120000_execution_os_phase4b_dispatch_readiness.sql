-- Phase 4B: Dispatch readiness evidence (append-only) + internal staff RLS.
-- NO dispatch completion, stock deduction, invoice/e-way generation, or finance mutation.

CREATE TABLE IF NOT EXISTS public.dispatch_readiness_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  queue_item_id uuid NULL,
  evidence_type text NOT NULL,
  evidence_status text NOT NULL,
  evidence_ref text NULL,
  photo_ref text NULL,
  document_ref text NULL,
  barcode_ref text NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_readiness_evidence_type_check CHECK (
    evidence_type IN (
      'packing_photo',
      'carton_barcode',
      'gate_scan',
      'reservation_check',
      'finance_signal',
      'document_placeholder',
      'manual_readiness_review'
    )
  ),
  CONSTRAINT dispatch_readiness_evidence_status_check CHECK (
    evidence_status IN ('pending', 'verified', 'rejected', 'missing', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_dispatch_readiness_evidence_order_id
  ON public.dispatch_readiness_evidence (order_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_readiness_evidence_correlation
  ON public.dispatch_readiness_evidence (correlation_id);

-- Append-only: block UPDATE and DELETE on evidence ledger
CREATE OR REPLACE FUNCTION public.dispatch_readiness_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'dispatch_readiness_evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_readiness_evidence_no_update ON public.dispatch_readiness_evidence;
CREATE TRIGGER trg_dispatch_readiness_evidence_no_update
  BEFORE UPDATE ON public.dispatch_readiness_evidence
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_readiness_evidence_immutable();

DROP TRIGGER IF EXISTS trg_dispatch_readiness_evidence_no_delete ON public.dispatch_readiness_evidence;
CREATE TRIGGER trg_dispatch_readiness_evidence_no_delete
  BEFORE DELETE ON public.dispatch_readiness_evidence
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_readiness_evidence_immutable();

ALTER TABLE public.dispatch_readiness_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_readiness_evidence_staff_select ON public.dispatch_readiness_evidence;
CREATE POLICY dispatch_readiness_evidence_staff_select ON public.dispatch_readiness_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
  );

DROP POLICY IF EXISTS dispatch_readiness_evidence_staff_insert ON public.dispatch_readiness_evidence;
CREATE POLICY dispatch_readiness_evidence_staff_insert ON public.dispatch_readiness_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
  );

COMMENT ON TABLE public.dispatch_readiness_evidence IS
  'Phase 4B append-only dispatch readiness evidence. Gate eligibility only — not dispatch completion.';
