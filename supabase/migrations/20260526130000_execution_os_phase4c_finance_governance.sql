-- Phase 4C: Finance governance evidence (append-only). No payment capture / invoicing.

CREATE TABLE IF NOT EXISTS public.finance_review_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  review_type text NOT NULL,
  review_status text NOT NULL,
  evidence_type text NOT NULL,
  evidence_ref text NULL,
  utr_ref text NULL,
  amount numeric NULL,
  currency text NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  override_reason text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT finance_review_evidence_type_check CHECK (
    review_type IN (
      'advance_verification',
      'credit_review',
      'finance_hold',
      'commercial_release',
      'override_review'
    )
  ),
  CONSTRAINT finance_review_evidence_status_check CHECK (
    review_status IN ('pending', 'verified', 'rejected', 'blocked', 'released')
  )
);

CREATE INDEX IF NOT EXISTS idx_finance_review_evidence_order_id
  ON public.finance_review_evidence (order_id);

CREATE OR REPLACE FUNCTION public.finance_review_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'finance_review_evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_review_evidence_no_update ON public.finance_review_evidence;
CREATE TRIGGER trg_finance_review_evidence_no_update
  BEFORE UPDATE ON public.finance_review_evidence
  FOR EACH ROW EXECUTE FUNCTION public.finance_review_evidence_immutable();

DROP TRIGGER IF EXISTS trg_finance_review_evidence_no_delete ON public.finance_review_evidence;
CREATE TRIGGER trg_finance_review_evidence_no_delete
  BEFORE DELETE ON public.finance_review_evidence
  FOR EACH ROW EXECUTE FUNCTION public.finance_review_evidence_immutable();

ALTER TABLE public.finance_review_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS finance_review_evidence_staff_select ON public.finance_review_evidence;
CREATE POLICY finance_review_evidence_staff_select ON public.finance_review_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
  );

DROP POLICY IF EXISTS finance_review_evidence_finance_insert ON public.finance_review_evidence;
CREATE POLICY finance_review_evidence_finance_insert ON public.finance_review_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) IN (
      'FINANCE_HEAD', 'FINANCE_EXEC', 'ADMIN', 'SUPER_ADMIN', 'OWNER'
    )
  );

COMMENT ON TABLE public.finance_review_evidence IS
  'Phase 4C append-only finance review evidence. Commercial release ≠ invoiced ≠ dispatched.';
