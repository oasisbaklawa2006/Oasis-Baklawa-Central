
-- Enable RLS on daily_production_logs
ALTER TABLE public.daily_production_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert and read production logs
CREATE POLICY "Authenticated can insert daily_production_logs"
  ON public.daily_production_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read daily_production_logs"
  ON public.daily_production_logs
  FOR SELECT
  TO authenticated
  USING (true);
