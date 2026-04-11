
-- Add tracking token for public tracking page
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS tracking_token text UNIQUE;

-- Backfill existing orders with tokens
UPDATE public.orders SET tracking_token = encode(gen_random_bytes(16), 'hex') WHERE tracking_token IS NULL;

-- Auto-generate token on insert
CREATE OR REPLACE FUNCTION public.generate_order_tracking_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_token IS NULL THEN
    NEW.tracking_token := encode(gen_random_bytes(16), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_tracking_token
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.generate_order_tracking_token();
