ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS fssai_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS registered_address text;