
-- Enable RLS on inward_material_advice
ALTER TABLE public.inward_material_advice ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert inward_material_advice"
  ON public.inward_material_advice FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read inward_material_advice"
  ON public.inward_material_advice FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can update inward_material_advice"
  ON public.inward_material_advice FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin','super_admin')));

-- Enable RLS on inward_material_items
ALTER TABLE public.inward_material_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert inward_material_items"
  ON public.inward_material_items FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can read inward_material_items"
  ON public.inward_material_items FOR SELECT TO authenticated
  USING (true);
