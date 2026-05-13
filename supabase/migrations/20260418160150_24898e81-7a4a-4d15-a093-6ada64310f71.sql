-- 1) Schema: add is_starter_pack flag to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_starter_pack boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.orders.is_starter_pack IS
  'True when the draft was created via Growth Intelligence Starter Builder. Cart waives carton-fill / MOQ enforcement for these orders so Grand Total exactly matches the displayed Estimated Investment.';

-- 2) Data: populate Assorted Baklawa Tin Pack 600gm pricing across tiers
--    MRP ₹1,200 → Bulk -20%, Wholesale -30%, HoReCa -25%, B2B -28%
UPDATE public.products
SET
  base_price      = 864,   -- B2B reference
  price_b2b       = 864,
  price_wholesale = 840,
  price_horeca    = 900,
  price_bulk      = 960
WHERE id = '1784505a-4a08-4661-8c92-5526b56a0730'
  AND COALESCE(price_b2b,0) = 0;