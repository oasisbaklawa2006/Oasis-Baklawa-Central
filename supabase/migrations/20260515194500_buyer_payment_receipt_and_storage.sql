-- Buyer payment receipt uploads → storage + order_payments audit fields

-- Receipts bucket for payment proofs (SPA uses getPublicUrl; keep public reads for URL compatibility)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'receipts',
  'receipts',
  true,
  52428800,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

-- Storage RLS cleanup (names stable for reapplies)
DROP POLICY IF EXISTS "receipts_buyers_upload_own_company_order" ON storage.objects;
DROP POLICY IF EXISTS "receipts_authenticated_select_company_or_staff" ON storage.objects;
DROP POLICY IF EXISTS "receipts_staff_manage" ON storage.objects;

-- Upload: authenticated buyer belonging to order's company; object key `{order_uuid}-{timestamp}.ext`
CREATE POLICY "receipts_buyers_upload_own_company_order"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-'
    AND EXISTS (
      SELECT 1
      FROM public.orders o
      JOIN public.users u ON u.company_id = o.company_id
      WHERE u.id = auth.uid()
        AND o.id::text = (substring(name FROM '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-'))
    )
  );

CREATE POLICY "receipts_authenticated_select_company_or_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      public.is_internal_staff(auth.uid())
      OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
      OR EXISTS (
        SELECT 1
        FROM public.orders o
        JOIN public.users u ON u.company_id = o.company_id
        WHERE u.id = auth.uid()
          AND o.id::text = (substring(name FROM '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-'))
      )
    )
  );

CREATE POLICY "receipts_staff_manage"
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      public.is_internal_staff(auth.uid())
      OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'receipts'
    AND (
      public.is_internal_staff(auth.uid())
      OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin')
    )
  );

-- Finance / buyer ledger fields used by Orders receipt flow and Finance board
ALTER TABLE public.order_payments
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS proof_storage_path text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS idx_order_payments_order_created
  ON public.order_payments(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_payments_status_created
  ON public.order_payments(status, created_at DESC) WHERE status IS NOT NULL;

COMMENT ON COLUMN public.order_payments.proof_storage_path IS 'Object key inside receipts bucket (no leading slash)';
COMMENT ON COLUMN public.order_payments.status IS 'e.g. under_review | verified | rejected | uploaded';
