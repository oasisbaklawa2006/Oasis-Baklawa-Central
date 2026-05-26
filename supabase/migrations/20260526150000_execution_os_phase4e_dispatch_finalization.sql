-- Phase 4E: Governed dispatch finalization — append-only release lineage.
-- orders.status → dispatched ONLY via application repository after lineage insert.

CREATE TABLE IF NOT EXISTS public.dispatch_release_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  previous_status text NOT NULL,
  next_status text NOT NULL,
  release_reason text NULL,
  release_type text NOT NULL,
  transporter_reference text NULL,
  gate_reference text NULL,
  completion_reference text NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  override_reason text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT dispatch_release_lineage_type_check CHECK (
    release_type IN (
      'finalize',
      'reversal',
      'stock_confirmation',
      'stock_reversal',
      'customer_publication',
      'transport_handoff',
      'override'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_dispatch_release_lineage_order_id
  ON public.dispatch_release_lineage (order_id);

CREATE INDEX IF NOT EXISTS idx_dispatch_release_lineage_correlation
  ON public.dispatch_release_lineage (correlation_id);

CREATE OR REPLACE FUNCTION public.dispatch_release_lineage_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'dispatch_release_lineage is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_release_lineage_no_update ON public.dispatch_release_lineage;
CREATE TRIGGER trg_dispatch_release_lineage_no_update
  BEFORE UPDATE ON public.dispatch_release_lineage
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_release_lineage_immutable();

DROP TRIGGER IF EXISTS trg_dispatch_release_lineage_no_delete ON public.dispatch_release_lineage;
CREATE TRIGGER trg_dispatch_release_lineage_no_delete
  BEFORE DELETE ON public.dispatch_release_lineage
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_release_lineage_immutable();

ALTER TABLE public.dispatch_release_lineage ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE ON public.dispatch_release_lineage FROM authenticated;
REVOKE UPDATE, DELETE ON public.dispatch_release_lineage FROM anon;

DROP POLICY IF EXISTS dispatch_release_lineage_staff_select ON public.dispatch_release_lineage;
CREATE POLICY dispatch_release_lineage_staff_select ON public.dispatch_release_lineage
  FOR SELECT TO authenticated
  USING (
    public.is_internal_staff(auth.uid())
    AND upper(public.get_user_role(auth.uid())) <> 'SALES_EXECUTIVE'
  );

DROP POLICY IF EXISTS dispatch_release_lineage_dispatch_insert ON public.dispatch_release_lineage;
CREATE POLICY dispatch_release_lineage_dispatch_insert ON public.dispatch_release_lineage
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

COMMENT ON TABLE public.dispatch_release_lineage IS
  'Phase 4E append-only dispatch release lineage. Governed orders.status mutation is auditable via correlation_id.';
