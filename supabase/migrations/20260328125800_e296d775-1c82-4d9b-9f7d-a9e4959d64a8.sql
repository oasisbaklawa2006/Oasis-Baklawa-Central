-- Enable RLS on order_returns and add policies
ALTER TABLE public.order_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert order_returns"
ON public.order_returns FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can read order_returns"
ON public.order_returns FOR SELECT TO authenticated
USING (true);