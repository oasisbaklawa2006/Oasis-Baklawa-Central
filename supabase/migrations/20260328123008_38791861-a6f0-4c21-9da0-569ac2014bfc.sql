ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert order_attachments"
ON public.order_attachments
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can read order_attachments"
ON public.order_attachments
FOR SELECT
TO authenticated
USING (true);