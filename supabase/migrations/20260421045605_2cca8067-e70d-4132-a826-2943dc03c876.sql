ALTER TABLE public.products ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}'::text[];

UPDATE public.products
SET aliases = ARRAY(SELECT DISTINCT unnest(COALESCE(aliases, '{}') || ARRAY['Kitta','Kita','Kitta Cashew','Pyramid Kaju']))
WHERE name ILIKE 'Cashew Pyramid%';

UPDATE public.products
SET aliases = ARRAY(SELECT DISTINCT unnest(COALESCE(aliases, '{}') || ARRAY['Mix Tart','Mixed Tart','Assorted Tart']))
WHERE name ILIKE 'Assorted Tart Baklawa%';

INSERT INTO public.product_aliases (alias_text, canonical_name)
SELECT a, p.name
FROM public.products p
CROSS JOIN LATERAL unnest(ARRAY['Kitta','Kita','Kitta Cashew','Pyramid Kaju']) AS a
WHERE p.name ILIKE 'Cashew Pyramid%'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_aliases pa WHERE lower(pa.alias_text) = lower(a)
  );

INSERT INTO public.product_aliases (alias_text, canonical_name)
SELECT a, p.name
FROM public.products p
CROSS JOIN LATERAL unnest(ARRAY['Mix Tart','Mixed Tart','Assorted Tart']) AS a
WHERE p.name ILIKE 'Assorted Tart Baklawa%'
  AND NOT EXISTS (
    SELECT 1 FROM public.product_aliases pa WHERE lower(pa.alias_text) = lower(a)
  );