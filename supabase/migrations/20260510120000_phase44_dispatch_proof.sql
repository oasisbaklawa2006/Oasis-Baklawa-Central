-- Phase 4.4: dispatch proof storage + distinguish partial vs full shipment rows on dispatches.

ALTER TABLE public.dispatches
  ADD COLUMN IF NOT EXISTS proof_storage_path text,
  ADD COLUMN IF NOT EXISTS is_partial boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.dispatches.proof_storage_path IS 'Storage path in receipts bucket (dispatch proof of handover)';
COMMENT ON COLUMN public.dispatches.is_partial IS 'True when this row records a partial shipment; order must not be closed from this row alone at security gate';
