CREATE OR REPLACE FUNCTION public.recalculate_erp_order_financials()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  calc_subtotal numeric := 0;
  calc_total numeric := 0;
BEGIN
  SELECT COALESCE(
    SUM(
      COALESCE(oi.quantity, 0) * COALESCE(
        p.price_per_kg,
        p.base_price,
        p.price_b2b,
        p.price_wholesale,
        p.wholesale_price,
        0
      )
    ),
    0
  )
  INTO calc_subtotal
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = NEW.order_id;

  calc_total := calc_subtotal * 1.18;

  UPDATE public.orders
  SET sales_order_value = calc_total,
      advance_required = calc_total * 0.5
  WHERE id = NEW.order_id;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_order_financials(_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calc_subtotal numeric := 0;
  calc_total numeric := 0;
BEGIN
  SELECT COALESCE(
    SUM(
      COALESCE(oi.quantity, 0) * COALESCE(
        p.price_per_kg,
        p.base_price,
        p.price_b2b,
        p.price_wholesale,
        p.wholesale_price,
        0
      )
    ),
    0
  )
  INTO calc_subtotal
  FROM public.order_items oi
  JOIN public.products p ON p.id = oi.product_id
  WHERE oi.order_id = _order_id;

  calc_total := calc_subtotal * 1.18;

  UPDATE public.orders
  SET sales_order_value = calc_total,
      advance_required = calc_total * 0.5
  WHERE id = _order_id;

  RETURN calc_total;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_order_financials(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_order_financials(uuid) TO authenticated;