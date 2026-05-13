
-- Production Jobs table
CREATE TABLE public.production_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id uuid REFERENCES public.order_items(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  department text NOT NULL,
  assigned_to uuid,
  assigned_qty numeric NOT NULL DEFAULT 0,
  produced_qty numeric DEFAULT 0,
  wasted_qty numeric DEFAULT 0,
  net_weight_per_unit numeric DEFAULT 0,
  batch_number text,
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'red')),
  stage text NOT NULL DEFAULT 'prep' CHECK (stage IN ('prep', 'processing', 'finishing', 'ready')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'in_production', 'paused', 'completed', 'transferred')),
  rejection_reason text,
  started_at timestamptz,
  completed_at timestamptz,
  locked boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.production_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff can view production_jobs"
ON public.production_jobs FOR SELECT TO authenticated
USING (is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can insert production_jobs"
ON public.production_jobs FOR INSERT TO authenticated
WITH CHECK (is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff can update production_jobs"
ON public.production_jobs FOR UPDATE TO authenticated
USING (is_internal_staff(auth.uid()));

-- Production Pauses table
CREATE TABLE public.production_pauses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('machine_breakdown', 'material_shortage', 'other')),
  comment text,
  paused_at timestamptz DEFAULT now(),
  resumed_at timestamptz,
  paused_by uuid
);

ALTER TABLE public.production_pauses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage production_pauses"
ON public.production_pauses FOR ALL TO authenticated
USING (is_internal_staff(auth.uid()));

-- Production Issues table
CREATE TABLE public.production_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  department text NOT NULL,
  issue_type text NOT NULL CHECK (issue_type IN ('material', 'machine', 'delay')),
  comment text,
  photo_url text,
  reported_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.production_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage production_issues"
ON public.production_issues FOR ALL TO authenticated
USING (is_internal_staff(auth.uid()));

-- RGS Transfer records
CREATE TABLE public.production_rgs_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.production_jobs(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  quantity numeric NOT NULL DEFAULT 0,
  batch_number text,
  transferred_by uuid,
  rgs_notified boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.production_rgs_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage rgs_transfers"
ON public.production_rgs_transfers FOR ALL TO authenticated
USING (is_internal_staff(auth.uid()));

-- Index for fast department filtering
CREATE INDEX idx_production_jobs_department ON public.production_jobs(department);
CREATE INDEX idx_production_jobs_status ON public.production_jobs(status);
