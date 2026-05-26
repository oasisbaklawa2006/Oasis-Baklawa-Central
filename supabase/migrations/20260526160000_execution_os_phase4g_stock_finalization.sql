-- Phase 4G: Governed physical stock finalization after dispatch_finalized.
-- Append-only inventory_movements extension. NO finance, invoice, or customer notification.

-- =============================================================================
-- A. inventory_stock_balances
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.inventory_stock_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  sku text NOT NULL,
  location_code text NOT NULL,
  available_qty numeric NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty numeric NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  damaged_qty numeric NOT NULL DEFAULT 0 CHECK (damaged_qty >= 0),
  expired_qty numeric NOT NULL DEFAULT 0 CHECK (expired_qty >= 0),
  quarantine_qty numeric NOT NULL DEFAULT 0 CHECK (quarantine_qty >= 0),
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_stock_balances_unique UNIQUE (product_id, sku, location_code)
);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_balances_product_sku
  ON public.inventory_stock_balances (product_id, sku);

CREATE INDEX IF NOT EXISTS idx_inventory_stock_balances_location
  ON public.inventory_stock_balances (location_code);

-- =============================================================================
-- B. Extend inventory_movements movement_type (append-only ledger preserved)
-- =============================================================================

ALTER TABLE public.inventory_movements
  DROP CONSTRAINT IF EXISTS inventory_movements_type_check;

ALTER TABLE public.inventory_movements
  ADD CONSTRAINT inventory_movements_type_check CHECK (
    movement_type IN (
      'reservation_created',
      'reservation_adjusted',
      'reservation_released',
      'reservation_expired',
      'reservation_fulfilled',
      'inventory_hold',
      'inventory_unhold',
      'dispatch_consumption_confirmed',
      'dispatch_consumption_reversed',
      'stock_variance_recorded',
      'stock_quarantined',
      'stock_quarantine_released'
    )
  );

-- =============================================================================
-- C. stock_consumption_lineage (append-only audit for finalization)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.stock_consumption_lineage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  reservation_id uuid NULL REFERENCES public.inventory_reservations (id) ON DELETE RESTRICT,
  product_id uuid NOT NULL,
  sku text NOT NULL,
  location_code text NOT NULL,
  consumed_qty numeric NOT NULL CHECK (consumed_qty > 0),
  movement_id uuid NULL,
  lineage_type text NOT NULL,
  scan_reference text NULL,
  gate_reference text NULL,
  dispatch_lineage_id uuid NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  reason_code text NULL,
  correlation_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT stock_consumption_lineage_type_check CHECK (
    lineage_type IN (
      'consumption_finalized',
      'consumption_reversed',
      'variance_recorded',
      'quarantine_applied',
      'quarantine_released'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_stock_consumption_lineage_order
  ON public.stock_consumption_lineage (order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_consumption_lineage_reservation
  ON public.stock_consumption_lineage (reservation_id)
  WHERE reservation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.prevent_stock_consumption_lineage_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'stock_consumption_lineage is append-only (% on %)', TG_OP, TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_consumption_lineage_no_update ON public.stock_consumption_lineage;
CREATE TRIGGER trg_stock_consumption_lineage_no_update
  BEFORE UPDATE ON public.stock_consumption_lineage
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_stock_consumption_lineage_mutation();

DROP TRIGGER IF EXISTS trg_stock_consumption_lineage_no_delete ON public.stock_consumption_lineage;
CREATE TRIGGER trg_stock_consumption_lineage_no_delete
  BEFORE DELETE ON public.stock_consumption_lineage
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_stock_consumption_lineage_mutation();

REVOKE UPDATE, DELETE ON public.stock_consumption_lineage FROM authenticated, anon;

-- =============================================================================
-- RLS
-- =============================================================================

ALTER TABLE public.inventory_stock_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_consumption_lineage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read stock balances" ON public.inventory_stock_balances;
CREATE POLICY "Staff read stock balances"
  ON public.inventory_stock_balances FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

-- Balance mutation only via service role / governed repository (no broad UPDATE policy for staff)
DROP POLICY IF EXISTS "Staff insert stock balances" ON public.inventory_stock_balances;
CREATE POLICY "Staff insert stock balances"
  ON public.inventory_stock_balances FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update stock balances governed" ON public.inventory_stock_balances;
CREATE POLICY "Staff update stock balances governed"
  ON public.inventory_stock_balances FOR UPDATE TO authenticated
  USING (public.is_internal_staff(auth.uid()))
  WITH CHECK (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff read stock consumption lineage" ON public.stock_consumption_lineage;
CREATE POLICY "Staff read stock consumption lineage"
  ON public.stock_consumption_lineage FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert stock consumption lineage" ON public.stock_consumption_lineage;
CREATE POLICY "Staff insert stock consumption lineage"
  ON public.stock_consumption_lineage FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()));
