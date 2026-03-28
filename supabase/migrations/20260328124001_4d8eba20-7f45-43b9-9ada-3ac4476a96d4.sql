ALTER TABLE public.freight_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert freight_ledger"
ON public.freight_ledger FOR INSERT TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can read freight_ledger"
ON public.freight_ledger FOR SELECT TO authenticated
USING (true);