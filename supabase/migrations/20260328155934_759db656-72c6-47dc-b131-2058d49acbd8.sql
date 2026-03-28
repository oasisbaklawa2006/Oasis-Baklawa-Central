
-- Enable RLS on commission_payouts
ALTER TABLE public.commission_payouts ENABLE ROW LEVEL SECURITY;

-- Admins can manage commission payouts
CREATE POLICY "Admins manage commission_payouts"
ON public.commission_payouts
FOR ALL
TO authenticated
USING (
  public.get_user_role(auth.uid()) IN ('admin', 'super_admin', 'finance_head')
);

-- Authenticated can read commission payouts
CREATE POLICY "Authenticated read commission_payouts"
ON public.commission_payouts
FOR SELECT
TO authenticated
USING (true);
