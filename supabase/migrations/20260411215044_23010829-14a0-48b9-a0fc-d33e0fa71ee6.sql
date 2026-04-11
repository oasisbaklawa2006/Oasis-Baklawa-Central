
-- Create product_aliases table
CREATE TABLE public.product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_text text NOT NULL,
  canonical_name text NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_product_aliases_alias ON public.product_aliases USING btree (lower(alias_text));

-- RLS
ALTER TABLE public.product_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_aliases"
ON public.product_aliases FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins manage product_aliases"
ON public.product_aliases FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['ADMIN','SUPER_ADMIN']))
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['ADMIN','SUPER_ADMIN']));

CREATE POLICY "Service role full access product_aliases"
ON public.product_aliases FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Seed alias data (product_id will be matched later via webhook lookup)
INSERT INTO public.product_aliases (alias_text, canonical_name) VALUES
  ('pyramid', 'Cashew Pyramid'),
  ('piramed', 'Cashew Pyramid'),
  ('pyramid special', 'Cashew Pyramid'),
  ('bulbul', 'Osh El Bulbul Cashew'),
  ('ashel', 'Osh El Bulbul Cashew'),
  ('osh el bulbul', 'Osh El Bulbul Cashew'),
  ('finger', 'Asabi Finger Baklawa'),
  ('asabi', 'Asabi Finger Baklawa'),
  ('asiyah', 'Asabi Finger Baklawa'),
  ('tart', 'Almond Tart'),
  ('crosole', 'Almond Tart'),
  ('almand', 'Almond Tart');
