-- Phase 2A.2: Stable human-readable sales order numbers (SO-YYYY-NNNNNN), unique per row.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS order_number text;

-- Deterministic backfill: per calendar year (UTC), ordered by created_at then id.
WITH numbered AS (
  SELECT
    id,
    (EXTRACT(YEAR FROM COALESCE(created_at, now()) AT TIME ZONE 'UTC'))::integer AS yr,
    ROW_NUMBER() OVER (
      PARTITION BY (EXTRACT(YEAR FROM COALESCE(created_at, now()) AT TIME ZONE 'UTC'))::integer
      ORDER BY COALESCE(created_at, now()) ASC, id ASC
    ) AS rn
  FROM public.orders
)
UPDATE public.orders o
SET order_number = 'SO-' || n.yr::text || '-' || lpad(n.rn::text, 6, '0')
FROM numbered n
WHERE o.id = n.id
  AND (o.order_number IS NULL OR btrim(o.order_number) = '');

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);

ALTER TABLE public.orders
ALTER COLUMN order_number SET NOT NULL;

COMMENT ON COLUMN public.orders.order_number IS 'Human-readable sales order reference SO-YYYY-NNNNNN (unique).';

CREATE OR REPLACE FUNCTION public.assign_order_number_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year integer;
  v_next bigint;
BEGIN
  IF NEW.order_number IS NOT NULL AND btrim(NEW.order_number) <> '' THEN
    RETURN NEW;
  END IF;

  v_year := (EXTRACT(YEAR FROM COALESCE(NEW.created_at, now()) AT TIME ZONE 'UTC'))::integer;

  PERFORM pg_advisory_xact_lock(58492001, v_year);

  SELECT COALESCE(MAX(substring(o.order_number FROM '^SO-[0-9]{4}-([0-9]+)$')::bigint), 0) + 1
  INTO v_next
  FROM public.orders o
  WHERE o.order_number LIKE 'SO-' || v_year::text || '-%';

  NEW.order_number := 'SO-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_assign_order_number_bi ON public.orders;
CREATE TRIGGER orders_assign_order_number_bi
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_order_number_on_insert();
