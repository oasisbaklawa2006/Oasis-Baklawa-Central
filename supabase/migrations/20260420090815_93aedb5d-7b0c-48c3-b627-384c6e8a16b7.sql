-- 1. Catalogue-driven weight fields on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS weight_per_box_kg numeric,
  ADD COLUMN IF NOT EXISTS grams_per_piece numeric;

-- 2. Per-line weight on order_items
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS weight_kg numeric;

-- 3. Order-level aggregates, parser confidence, clarification flag, soft-delete
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS total_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS parser_confidence numeric,
  ADD COLUMN IF NOT EXISTS needs_clarification boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_waste boolean NOT NULL DEFAULT false;

-- 4. Secondary phones array on users for Three-Step Sender Identification
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS secondary_phones text[] DEFAULT ARRAY[]::text[];

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_orders_is_waste ON public.orders (is_waste) WHERE is_waste = false;
CREATE INDEX IF NOT EXISTS idx_orders_needs_clarification ON public.orders (needs_clarification) WHERE needs_clarification = true;
CREATE INDEX IF NOT EXISTS idx_users_secondary_phones ON public.users USING GIN (secondary_phones);