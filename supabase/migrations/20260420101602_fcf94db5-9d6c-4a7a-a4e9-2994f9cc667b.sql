-- Add idempotency + duplicate tracking to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS wamid text,
  ADD COLUMN IF NOT EXISTS is_duplicate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS duplicate_of_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_wamid_unique_idx
  ON public.orders (wamid)
  WHERE wamid IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_is_duplicate_idx
  ON public.orders (is_duplicate)
  WHERE is_duplicate = true;

-- Add wamid + discard reason to debug_webhooks for fast dedup + logging
ALTER TABLE public.debug_webhooks
  ADD COLUMN IF NOT EXISTS wamid text,
  ADD COLUMN IF NOT EXISTS discard_reason text;

CREATE INDEX IF NOT EXISTS debug_webhooks_wamid_idx
  ON public.debug_webhooks (wamid)
  WHERE wamid IS NOT NULL;