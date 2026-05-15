-- Migration: Add finance verification audit trail to orders table
-- Purpose: Track who verified payment/credit and when
-- Date: 2026-05-15

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS finance_verified_by uuid
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS finance_verified_at timestamptz;

-- Comments for clarity
COMMENT ON COLUMN public.orders.finance_verified_by IS 'UUID of finance executive who verified payment or approved credit';
COMMENT ON COLUMN public.orders.finance_verified_at IS 'Timestamp when finance cleared this order for operations';

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_orders_finance_verified_by
  ON public.orders(finance_verified_by);

CREATE INDEX IF NOT EXISTS idx_orders_payment_status_finance
  ON public.orders(payment_status, finance_verified_at DESC);
