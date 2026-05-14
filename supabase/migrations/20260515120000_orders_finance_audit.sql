-- Migration: Finance verification audit trail on orders

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS finance_verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS finance_verified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_orders_finance_verified_by ON public.orders(finance_verified_by);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status_finance ON public.orders(payment_status, finance_verified_at DESC);
