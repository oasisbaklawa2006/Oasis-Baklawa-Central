
-- Extend support_tickets with complaint governance fields
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS product_sku text,
  ADD COLUMN IF NOT EXISTS qty_affected integer,
  ADD COLUMN IF NOT EXISTS proof_url text,
  ADD COLUMN IF NOT EXISTS dispatch_date date,
  ADD COLUMN IF NOT EXISTS window_status text DEFAULT 'WITHIN_WINDOW',
  ADD COLUMN IF NOT EXISTS routed_to_department text,
  ADD COLUMN IF NOT EXISTS assigned_employee_id uuid REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS sla_first_response_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS sla_first_response_due timestamptz,
  ADD COLUMN IF NOT EXISTS sla_action_due timestamptz,
  ADD COLUMN IF NOT EXISTS sla_resolution_due timestamptz,
  ADD COLUMN IF NOT EXISTS sla_state text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS severity text DEFAULT 'Medium',
  ADD COLUMN IF NOT EXISTS estimated_financial_loss numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_rating integer,
  ADD COLUMN IF NOT EXISTS admin_rating_speed integer,
  ADD COLUMN IF NOT EXISTS admin_rating_quality integer,
  ADD COLUMN IF NOT EXISTS admin_rating_communication integer,
  ADD COLUMN IF NOT EXISTS rejection_reason_template text,
  ADD COLUMN IF NOT EXISTS resolution_template_used text,
  ADD COLUMN IF NOT EXISTS ai_rewritten_reply text,
  ADD COLUMN IF NOT EXISTS escalated_to_hod boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_blocked boolean DEFAULT false;

-- Employee performance logs
CREATE TABLE IF NOT EXISTS public.employee_performance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES public.users(id) NOT NULL,
  total_handled integer DEFAULT 0,
  avg_rating numeric DEFAULT 0,
  sla_compliance_pct numeric DEFAULT 100,
  total_penalty_score integer DEFAULT 0,
  never_responded_count integer DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  period_end date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day')::date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(employee_id, period_start)
);

ALTER TABLE public.employee_performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage employee_performance_logs"
  ON public.employee_performance_logs FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) IN ('ADMIN','SUPER_ADMIN','FINANCE_HEAD'))
  WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN','SUPER_ADMIN','FINANCE_HEAD'));

CREATE POLICY "Authenticated read employee_performance_logs"
  ON public.employee_performance_logs FOR SELECT TO authenticated
  USING (true);

-- Ensure support_tickets has update policy for new fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Authenticated can update support_tickets'
  ) THEN
    CREATE POLICY "Authenticated can update support_tickets"
      ON public.support_tickets FOR UPDATE TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
