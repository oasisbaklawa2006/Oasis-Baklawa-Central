-- Phase 4D: Controlled dispatch completion governance evidence (append-only).
-- Attestation and review only — NO order.status mutation, stock deduction, invoicing, or payment capture.

CREATE TABLE IF NOT EXISTS public.dispatch_completion_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  queue_item_id uuid NULL,
  evidence_type text NOT NULL,
  evidence_status text NOT NULL,
  completion_status text NOT NULL,
  evidence_ref text NULL,
  courier_ref text NULL,
  manifest_ref text NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  override_reason text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_completion_evidence_type_check CHECK (
    evidence_type IN (
      'completion_review',
      'completion_attestation',
      'completion_hold',
      'completion_hold_release',
      'supervisor_override'
    )
  ),
  CONSTRAINT dispatch_completion_evidence_status_check CHECK (
    evidence_status IN ('pending', 'verified', 'rejected', 'blocked', 'released')
  ),
  CONSTRAINT dispatch_completion_evidence_completion_status_check CHECK (
    completion_status IN (
      'not_eligible',
      'prerequisites_pending',
      'completion_eligible',
      'completion_attested',
      'completion_blocked',
      'already_dispatched'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_dispatch_completion_evidence_order_id
  ON public.dispatch_completion_evidence (order_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_completion_evidence_correlation
  ON public.dispatch_completion_evidence (correlation_id);

CREATE OR REPLACE FUNCTION public.dispatch_completion_evidence_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'dispatch_completion_evidence is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_completion_evidence_no_update ON public.dispatch_completion_evidence;
CREATE TRIGGER trg_dispatch_completion_evidence_no_update
  BEFORE UPDATE ON public.dispatch_completion_evidence
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_completion_evidence_immutable();

DROP TRIGGER IF EXISTS trg_dispatch_completion_evidence_no_delete ON public.dispatch_completion_evidence;
CREATE TRIGGER trg_dispatch_completion_evidence_no_delete
  BEFORE DELETE ON public.dispatch_completion_evidence
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_completion_evidence_immutable();

ALTER TABLE public.dispatch_completion_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispatch_completion_evidence_staff_select ON public.dispatch_completion_evidence;
CREATE POLICY dispatch_completion_evidence_staff_select ON public.dispatch_completion_evidence
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
  );

DROP POLICY IF EXISTS dispatch_completion_evidence_dispatch_insert ON public.dispatch_completion_evidence;
CREATE POLICY dispatch_completion_evidence_dispatch_insert ON public.dispatch_completion_evidence
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) IN (
      'DISPATCH_MANAGER',
      'DISPATCH_HEAD',
      'DISPATCH_INCHARGE',
      'OPERATIONS_MANAGER',
      'ADMIN',
      'SUPER_ADMIN',
      'OWNER'
    )
  );

COMMENT ON TABLE public.dispatch_completion_evidence IS
  'Phase 4D append-only dispatch completion governance. Attestation ≠ orders.status dispatched ≠ stock deduct.';
