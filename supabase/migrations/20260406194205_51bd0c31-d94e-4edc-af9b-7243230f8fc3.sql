-- First delete orphaned order_items for phantom drafts
DELETE FROM public.order_items
WHERE order_id IN (
  SELECT id FROM public.orders
  WHERE sales_order_value = 0
    AND status = 'draft'
    AND created_at < (now() - interval '1 hour')
);

-- Then delete the phantom draft orders themselves
DELETE FROM public.orders
WHERE sales_order_value = 0
  AND status = 'draft'
  AND created_at < (now() - interval '1 hour');