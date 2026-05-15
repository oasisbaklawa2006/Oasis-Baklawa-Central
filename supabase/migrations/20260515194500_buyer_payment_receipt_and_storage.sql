-- Migration: Extend order_payments with proof verification audit trail + buyer receipt storage RLS
-- Purpose: Create audit trail for payment proofs and enable buyer receipt uploads
-- Date: 2026-05-15

-- ============================================================================
-- PART A: Extend order_payments table with proof verification columns
-- ============================================================================

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS proof_url text;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS proof_storage_path text;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS verified_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'uploaded';

ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Comments for clarity
COMMENT ON COLUMN public.order_payments.proof_url IS 'Public URL of payment receipt from Supabase receipts bucket';
COMMENT ON COLUMN public.order_payments.proof_storage_path IS 'Internal storage path for payment proof in receipts bucket';
COMMENT ON COLUMN public.order_payments.verified_by IS 'UUID of finance executive who verified this payment proof';
COMMENT ON COLUMN public.order_payments.verified_at IS 'Timestamp when finance verified the proof';
COMMENT ON COLUMN public.order_payments.status IS 'Payment proof status: uploaded | verified | rejected';
COMMENT ON COLUMN public.order_payments.rejection_reason IS 'If rejected, reason for rejection (missing details, invalid UTR, etc)';

-- Indexes for verification lookups
CREATE INDEX IF NOT EXISTS idx_order_payments_status
  ON public.order_payments(status);

CREATE INDEX IF NOT EXISTS idx_order_payments_order_status
  ON public.order_payments(order_id, status);

CREATE INDEX IF NOT EXISTS idx_order_payments_verified_by
  ON public.order_payments(verified_by);

-- ============================================================================
-- PART B: Create receipts storage bucket and policies
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
  VALUES ('receipts', 'receipts', false)
  ON CONFLICT (id) DO NOTHING;

-- Align bucket visibility with finance requirements (private bucket + RLS on objects)
UPDATE storage.buckets SET public = false WHERE id = 'receipts';

-- Remove legacy permissive receipt policies if present (replaced by PART E)
DROP POLICY IF EXISTS "Allow public reads of receipts" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to receipts" ON storage.objects;

-- ============================================================================
-- PART C: RLS Policies for buyer order update (attached receipt to submitted order)
-- ============================================================================

DROP POLICY IF EXISTS "buyer_update_submitted_order_receipt" ON public.orders;

CREATE POLICY "buyer_update_submitted_order_receipt"
  ON public.orders FOR UPDATE
  TO authenticated
  USING (
    company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
    AND status IN ('submitted', 'under_review')
  )
  WITH CHECK (
    company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
    AND status IN ('submitted', 'under_review')
  );

-- ============================================================================
-- PART D: RLS Policies for order_payments table
-- ============================================================================

DROP POLICY IF EXISTS "buyer_insert_own_order_payments" ON public.order_payments;

CREATE POLICY "buyer_insert_own_order_payments"
  ON public.order_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
    )
  );

DROP POLICY IF EXISTS "buyer_read_own_order_payments" ON public.order_payments;

CREATE POLICY "buyer_read_own_order_payments"
  ON public.order_payments FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE company_id = (SELECT u.company_id FROM public.users u WHERE u.id = auth.uid() LIMIT 1)
    )
  );

-- ============================================================================
-- PART E: Storage bucket policies for receipt uploads
-- ============================================================================

DROP POLICY IF EXISTS "authenticated_upload_receipts" ON storage.objects;

CREATE POLICY "authenticated_upload_receipts"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (auth.jwt() ->> 'sub') IS NOT NULL
  );

DROP POLICY IF EXISTS "public_read_receipts" ON storage.objects;

CREATE POLICY "public_read_receipts"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "authenticated_delete_receipts" ON storage.objects;

CREATE POLICY "authenticated_delete_receipts"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND owner_id = (SELECT auth.uid()::text)
  );
