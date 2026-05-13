
-- Add outcome column to client_interactions
ALTER TABLE public.client_interactions
ADD COLUMN IF NOT EXISTS outcome text;

-- Create CRM tasks table
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  sales_exec_id uuid REFERENCES public.users(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  task_type text NOT NULL DEFAULT 'follow_up',
  description text,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage crm_tasks"
ON public.crm_tasks FOR ALL
TO authenticated
USING (get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_HEAD'))
WITH CHECK (get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE_HEAD'));

-- Sales execs see tasks for their assigned clients
CREATE POLICY "Sales execs read own crm_tasks"
ON public.crm_tasks FOR SELECT
TO authenticated
USING (is_account_manager(auth.uid(), company_id) OR sales_exec_id = auth.uid());

-- Sales execs can insert tasks for their clients
CREATE POLICY "Sales execs insert crm_tasks"
ON public.crm_tasks FOR INSERT
TO authenticated
WITH CHECK (is_account_manager(auth.uid(), company_id) OR sales_exec_id = auth.uid() OR get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN'));

-- Sales execs can update their own tasks
CREATE POLICY "Sales execs update own crm_tasks"
ON public.crm_tasks FOR UPDATE
TO authenticated
USING (sales_exec_id = auth.uid() OR get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN'))
WITH CHECK (sales_exec_id = auth.uid() OR get_user_role(auth.uid()) IN ('ADMIN', 'SUPER_ADMIN'));

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_crm_tasks_exec ON public.crm_tasks(sales_exec_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status, due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_company ON public.crm_tasks(company_id);
