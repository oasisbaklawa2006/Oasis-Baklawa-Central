-- Reconcile the Phase 2 B2B fulfilment schema that was applied to production
-- under generated migration versions before the reviewed repository files were
-- finalised. This migration is intentionally data-preserving and replay-safe.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

-- Production received a receipt-line identity that omitted the Oasis batch.
-- Rebuild it to the reviewed identity so separate Oasis batches can coexist.
DROP INDEX IF EXISTS public.idx_b2b_inventory_receipt_lines_identity;

CREATE UNIQUE INDEX idx_b2b_inventory_receipt_lines_identity
  ON public.b2b_inventory_receipt_lines (
    receipt_id,
    product_id,
    sku,
    coalesce(supplier_batch_lot, ''),
    coalesce(oasis_batch_lot, '')
  );

-- Remove the earlier floating tolerance. Inventory classifications must
-- reconcile exactly; the Phase 3 governed RPC performs the same check.
ALTER TABLE public.b2b_inventory_receipt_lines
  DROP CONSTRAINT IF EXISTS b2b_inventory_receipt_lines_reconcile_check;

ALTER TABLE public.b2b_inventory_receipt_lines
  ADD CONSTRAINT b2b_inventory_receipt_lines_reconcile_check CHECK (
    accepted_qty + damaged_qty + rejected_qty <= received_qty
  );

ALTER TABLE public.b2b_assembly_jobs
  DROP CONSTRAINT IF EXISTS b2b_assembly_jobs_output_check;

ALTER TABLE public.b2b_assembly_jobs
  ADD CONSTRAINT b2b_assembly_jobs_output_check CHECK (
    accepted_qty + rejected_qty <= completed_qty
  );

ALTER TABLE public.b2b_assembly_components
  DROP CONSTRAINT IF EXISTS b2b_assembly_components_issue_check;

ALTER TABLE public.b2b_assembly_components
  ADD CONSTRAINT b2b_assembly_components_issue_check CHECK (
    consumed_qty + wasted_qty + returned_qty <= issued_qty
  );

COMMENT ON INDEX public.idx_b2b_inventory_receipt_lines_identity IS
  'Unique receipt-line identity including both supplier and Oasis batch/lot values.';
