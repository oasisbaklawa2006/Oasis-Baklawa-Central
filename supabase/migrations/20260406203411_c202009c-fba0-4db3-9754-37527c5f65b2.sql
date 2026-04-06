
-- Add settlement_unit to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS settlement_unit text DEFAULT 'KG';

-- Create product_bom table
CREATE TABLE IF NOT EXISTS public.product_bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  component_name text,
  quantity_per_unit numeric NOT NULL DEFAULT 1,
  source_department text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.product_bom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read product_bom"
  ON public.product_bom FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff manage product_bom"
  ON public.product_bom FOR ALL TO authenticated
  USING (public.is_internal_staff(auth.uid()) OR public.get_user_role(auth.uid()) IN ('admin', 'super_admin'));
