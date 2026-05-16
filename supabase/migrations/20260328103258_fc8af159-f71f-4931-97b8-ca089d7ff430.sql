-- Enable RLS on credit_requests
ALTER TABLE public.credit_requests ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert credit requests
CREATE POLICY "Authenticated can insert credit_requests"
ON public.credit_requests
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Authenticated users can read credit requests
CREATE POLICY "Authenticated can read credit_requests"
ON public.credit_requests
FOR SELECT
TO authenticated
USING (true);

-- Admins can manage all credit requests
CREATE POLICY "Admins manage credit_requests"
ON public.credit_requests
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
));