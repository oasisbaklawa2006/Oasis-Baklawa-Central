-- Phase 4A: Governed inventory reservations + immutable movement ledger.
-- Reservation-first model. NO stock deduction, dispatch completion, or finance mutation.

-- =============================================================================
-- A. inventory_reservations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_number text NOT NULL,
  order_id uuid NOT NULL,
  queue_item_id uuid NULL REFERENCES public.operational_queue_items (id) ON DELETE RESTRICT,
  customer_id uuid NULL,
  product_id uuid NOT NULL,
  sku text NOT NULL,
  requested_qty numeric NOT NULL CHECK (requested_qty > 0),
  reserved_qty numeric NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  fulfilled_qty numeric NOT NULL DEFAULT 0 CHECK (fulfilled_qty >= 0),
  released_qty numeric NOT NULL DEFAULT 0 CHECK (released_qty >= 0),
  reservation_status text NOT NULL DEFAULT 'pending',
  reservation_priority text NOT NULL DEFAULT 'normal',
  source_department text NULL,
  reserved_by uuid NULL,
  approved_by uuid NULL,
  expires_at timestamptz NULL,
  notes text NULL,
  correlation_id text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reservations_number_unique UNIQUE (reservation_number),
  CONSTRAINT inventory_reservations_status_check CHECK (
    reservation_status IN (
      'pending', 'reserved', 'partially_reserved', 'blocked',
      'released', 'expired', 'fulfilled', 'cancelled'
    )
  ),
  CONSTRAINT inventory_reservations_priority_check CHECK (
    reservation_priority IN ('low', 'normal', 'high', 'urgent')
  ),
  CONSTRAINT inventory_reservations_qty_coherent CHECK (
    reserved_qty + fulfilled_qty + released_qty <= requested_qty + 0.0001
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_order_id
  ON public.inventory_reservations (order_id);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_product_sku
  ON public.inventory_reservations (product_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_status
  ON public.inventory_reservations (reservation_status);

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_expires_at
  ON public.inventory_reservations (expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_reservations_queue_item
  ON public.inventory_reservations (queue_item_id)
  WHERE queue_item_id IS NOT NULL;

-- =============================================================================
-- B. inventory_reservation_allocations
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_reservation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.inventory_reservations (id) ON DELETE RESTRICT,
  inventory_entity_type text NOT NULL,
  inventory_entity_id uuid NOT NULL,
  allocated_qty numeric NOT NULL CHECK (allocated_qty > 0),
  allocation_status text NOT NULL DEFAULT 'active',
  allocated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reservation_allocations_status_check CHECK (
    allocation_status IN ('active', 'released', 'expired', 'fulfilled', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_reservation_allocations_reservation
  ON public.inventory_reservation_allocations (reservation_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_reservation_allocations_entity_active
  ON public.inventory_reservation_allocations (reservation_id, inventory_entity_type, inventory_entity_id)
  WHERE allocation_status = 'active';

-- =============================================================================
-- C. inventory_movements (append-only ledger)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_type text NOT NULL,
  reservation_id uuid NULL REFERENCES public.inventory_reservations (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  sku text NOT NULL,
  quantity numeric NOT NULL,
  source_location text NULL,
  destination_location text NULL,
  actor_id uuid NULL,
  reason_code text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_movements_type_check CHECK (
    movement_type IN (
      'reservation_created',
      'reservation_adjusted',
      'reservation_released',
      'reservation_expired',
      'reservation_fulfilled',
      'inventory_hold',
      'inventory_unhold'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_reservation_id
  ON public.inventory_movements (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_sku
  ON public.inventory_movements (product_id, sku, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_correlation_id
  ON public.inventory_movements (correlation_id);

CREATE OR REPLACE FUNCTION public.prevent_inventory_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'inventory_movements are append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_movements_no_update ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_no_update
  BEFORE UPDATE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_movement_mutation();

DROP TRIGGER IF EXISTS trg_inventory_movements_no_delete ON public.inventory_movements;
CREATE TRIGGER trg_inventory_movements_no_delete
  BEFORE DELETE ON public.inventory_movements
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_movement_mutation();

REVOKE UPDATE, DELETE ON public.inventory_movements FROM authenticated, anon;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservation_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read inventory reservations" ON public.inventory_reservations;
CREATE POLICY "Staff read inventory reservations"
  ON public.inventory_reservations FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert inventory reservations" ON public.inventory_reservations;
CREATE POLICY "Staff insert inventory reservations"
  ON public.inventory_reservations FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update inventory reservations" ON public.inventory_reservations;
CREATE POLICY "Staff update inventory reservations"
  ON public.inventory_reservations FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read reservation allocations" ON public.inventory_reservation_allocations;
CREATE POLICY "Staff read reservation allocations"
  ON public.inventory_reservation_allocations FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert reservation allocations" ON public.inventory_reservation_allocations;
CREATE POLICY "Staff insert reservation allocations"
  ON public.inventory_reservation_allocations FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update reservation allocations" ON public.inventory_reservation_allocations;
CREATE POLICY "Staff update reservation allocations"
  ON public.inventory_reservation_allocations FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read inventory movements" ON public.inventory_movements;
CREATE POLICY "Staff read inventory movements"
  ON public.inventory_movements FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert inventory movements" ON public.inventory_movements;
CREATE POLICY "Staff insert inventory movements"
  ON public.inventory_movements FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

COMMENT ON TABLE public.inventory_reservations IS
  'Phase 4A governed inventory reservations. Writes via reservation repository only.';
COMMENT ON TABLE public.inventory_movements IS
  'Append-only inventory movement ledger. UPDATE/DELETE blocked.';
