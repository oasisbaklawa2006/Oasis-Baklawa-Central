
-- Enable RLS on store_requisitions and store_requisition_items
ALTER TABLE public.store_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_requisition_items ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access on store_requisitions
CREATE POLICY "Authenticated full access store_requisitions"
  ON public.store_requisitions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users full access on store_requisition_items
CREATE POLICY "Authenticated full access store_requisition_items"
  ON public.store_requisition_items
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
