-- SURGICAL CATALOGUE UPGRADE: Category-aware product fields (additive only).
-- No existing columns are altered or removed. No RLS or auth changes.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS product_family text,
  ADD COLUMN IF NOT EXISTS dimensions text,
  ADD COLUMN IF NOT EXISTS material text,
  ADD COLUMN IF NOT EXISTS gross_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS bom_summary text;

COMMENT ON COLUMN public.products.product_family IS
  'High-level family used for category-aware UI: bulk_sweets | goldware | hampers | retail_pack. Optional — falls back to category inference.';
COMMENT ON COLUMN public.products.dimensions IS
  'Free-text size for non-food items (e.g. "12-inch", "10 x 8 in").';
COMMENT ON COLUMN public.products.material IS
  'Construction material for goldware/packaging (e.g. "Brass", "Acrylic").';
COMMENT ON COLUMN public.products.gross_weight_kg IS
  'Total shipping weight for hampers / gift packs including packaging.';
COMMENT ON COLUMN public.products.bom_summary IS
  'Human-readable summary of included items for hampers (e.g. "2x Asabi 250g, 1x Pyramid 500g").';

-- Backfill product_family from category for existing rows (non-destructive — only fills NULL).
UPDATE public.products
SET product_family = CASE
  WHEN product_family IS NOT NULL THEN product_family
  WHEN lower(coalesce(category,'')) LIKE '%hamper%' OR lower(coalesce(category,'')) LIKE '%gift%' THEN 'hampers'
  WHEN lower(coalesce(category,'')) LIKE '%goldware%' OR lower(coalesce(category,'')) LIKE '%packaging%' OR lower(coalesce(category,'')) LIKE '%platter%' OR lower(coalesce(category,'')) LIKE '%basket%' OR lower(coalesce(category,'')) LIKE '%tray%' THEN 'goldware'
  WHEN lower(coalesce(category,'')) LIKE '%bulk%' THEN 'bulk_sweets'
  ELSE 'retail_pack'
END
WHERE product_family IS NULL;