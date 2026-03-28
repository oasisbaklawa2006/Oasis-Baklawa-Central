
-- Allow any authenticated user to update inward_material_advice status (for gate guards)
CREATE POLICY "Authenticated can update inward_material_advice_status"
  ON public.inward_material_advice FOR UPDATE TO authenticated
  USING (true);
