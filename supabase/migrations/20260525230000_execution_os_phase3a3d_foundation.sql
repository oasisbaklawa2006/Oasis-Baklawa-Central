-- Phase 3A/3D: Durable operational queues + append-only operational events.
-- Narrow scope: queue lifecycle + audit events only. No finance/stock/dispatch completion mutations.

-- =============================================================================
-- A. operational_queue_items
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operational_queue_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  order_id uuid NULL,
  customer_id uuid NULL,
  title text NOT NULL,
  summary text NULL,
  priority text NOT NULL DEFAULT 'normal',
  state text NOT NULL DEFAULT 'pending',
  owner_department text NULL,
  assigned_to uuid NULL,
  escalation_level text NOT NULL DEFAULT 'none',
  blocker_code text NULL,
  blocker_summary text NULL,
  sla_due_at timestamptz NULL,
  source text NOT NULL DEFAULT 'execution_os',
  version integer NOT NULL DEFAULT 1,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL,
  cancelled_at timestamptz NULL,
  CONSTRAINT operational_queue_items_state_check CHECK (
    state IN (
      'pending', 'acknowledged', 'assigned', 'in_progress',
      'blocked', 'escalated', 'completed', 'failed', 'cancelled'
    )
  ),
  CONSTRAINT operational_queue_items_escalation_level_check CHECK (
    escalation_level IN ('none', 'tier1', 'tier2', 'tier3', 'cmd')
  )
);

CREATE INDEX IF NOT EXISTS idx_operational_queue_items_queue_state
  ON public.operational_queue_items (queue_type, state);

CREATE INDEX IF NOT EXISTS idx_operational_queue_items_order_id
  ON public.operational_queue_items (order_id)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_queue_items_assigned_to
  ON public.operational_queue_items (assigned_to)
  WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_queue_items_owner_department
  ON public.operational_queue_items (owner_department)
  WHERE owner_department IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_queue_items_sla_due_at
  ON public.operational_queue_items (sla_due_at)
  WHERE sla_due_at IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_queue_items_source_entity
  ON public.operational_queue_items (source, queue_type, entity_type, entity_id)
  WHERE state NOT IN ('completed', 'cancelled');

-- =============================================================================
-- B. operational_queue_assignments (append history)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operational_queue_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_item_id uuid NOT NULL REFERENCES public.operational_queue_items (id) ON DELETE RESTRICT,
  from_user_id uuid NULL,
  to_user_id uuid NULL,
  from_department text NULL,
  to_department text NULL,
  reason text NULL,
  assigned_by uuid NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operational_queue_assignments_item
  ON public.operational_queue_assignments (queue_item_id, assigned_at DESC);

-- =============================================================================
-- C. operational_events (append-only)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.operational_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  order_id uuid NULL,
  customer_id uuid NULL,
  queue_item_id uuid NULL REFERENCES public.operational_queue_items (id) ON DELETE RESTRICT,
  actor_id uuid NULL,
  actor_role text NULL,
  actor_department text NULL,
  visibility text NOT NULL DEFAULT 'internal',
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NULL,
  reason_code text NULL,
  reason_text text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text NOT NULL,
  idempotency_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operational_events_visibility_check CHECK (
    visibility IN ('internal', 'public_candidate', 'staff_only')
  ),
  CONSTRAINT operational_events_severity_check CHECK (
    severity IN ('info', 'warning', 'urgent', 'critical')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_operational_events_idempotency_key
  ON public.operational_events (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_events_entity_created
  ON public.operational_events (entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_operational_events_order_created
  ON public.operational_events (order_id, created_at DESC)
  WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_events_queue_item_created
  ON public.operational_events (queue_item_id, created_at DESC)
  WHERE queue_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_operational_events_correlation_id
  ON public.operational_events (correlation_id);

-- Append-only enforcement
CREATE OR REPLACE FUNCTION public.prevent_operational_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'operational_events are append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_operational_events_no_update ON public.operational_events;
CREATE TRIGGER trg_operational_events_no_update
  BEFORE UPDATE ON public.operational_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_operational_event_mutation();

DROP TRIGGER IF EXISTS trg_operational_events_no_delete ON public.operational_events;
CREATE TRIGGER trg_operational_events_no_delete
  BEFORE DELETE ON public.operational_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_operational_event_mutation();

REVOKE UPDATE, DELETE ON public.operational_events FROM authenticated, anon;

-- =============================================================================
-- RLS (conservative: internal staff read; authenticated staff write queues)
-- =============================================================================

ALTER TABLE public.operational_queue_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_queue_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operational_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read operational queue items" ON public.operational_queue_items;
CREATE POLICY "Staff read operational queue items"
  ON public.operational_queue_items FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert operational queue items" ON public.operational_queue_items;
CREATE POLICY "Staff insert operational queue items"
  ON public.operational_queue_items FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update operational queue items" ON public.operational_queue_items;
CREATE POLICY "Staff update operational queue items"
  ON public.operational_queue_items FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read operational queue assignments" ON public.operational_queue_assignments;
CREATE POLICY "Staff read operational queue assignments"
  ON public.operational_queue_assignments FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert operational queue assignments" ON public.operational_queue_assignments;
CREATE POLICY "Staff insert operational queue assignments"
  ON public.operational_queue_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read operational events" ON public.operational_events;
CREATE POLICY "Staff read operational events"
  ON public.operational_events FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert operational events" ON public.operational_events;
CREATE POLICY "Staff insert operational events"
  ON public.operational_events FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

COMMENT ON TABLE public.operational_queue_items IS
  'Phase 3A durable work queue items. Lifecycle writes must emit operational_events.';
COMMENT ON TABLE public.operational_events IS
  'Phase 3D append-only operational event store. UPDATE/DELETE blocked by trigger and REVOKE.';
