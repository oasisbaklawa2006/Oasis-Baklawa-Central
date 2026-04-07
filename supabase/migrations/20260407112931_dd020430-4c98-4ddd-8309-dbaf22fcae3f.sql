-- Drop the existing constraint
ALTER TABLE public.products
DROP CONSTRAINT IF EXISTS products_production_department_check;

-- Add the new constraint with the updated list of allowed departments
ALTER TABLE public.products
ADD CONSTRAINT products_production_department_check
CHECK (production_department IN ('Arabic Sweets', 'Chocolates', 'Bakery', 'Dragees', 'Fusion Sweets', 'Seasoned Nuts', 'Packing & Assembly', '3rd Party Store'));

-- Add visible_in_catalog column for "Not For Sale" toggle
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS visible_in_catalog boolean NOT NULL DEFAULT true;