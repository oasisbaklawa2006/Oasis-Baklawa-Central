-- Buyer-visible finance rejection note (audit_logs remain admin-only for SELECT).
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_rejection_reason text;

COMMENT ON COLUMN public.orders.payment_rejection_reason IS
  'Latest finance rejection message when payment is sent back to awaiting_receipt; cleared when buyer uploads a new receipt or finance verifies/credits.';
