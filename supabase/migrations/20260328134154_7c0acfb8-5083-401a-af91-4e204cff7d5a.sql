
-- Add settlement fields to inward_material_advice
ALTER TABLE public.inward_material_advice
  ADD COLUMN IF NOT EXISTS fault_attribution text,
  ADD COLUMN IF NOT EXISTS settlement_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS settled_by uuid,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;
