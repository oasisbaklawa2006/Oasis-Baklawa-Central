
-- =============================================
-- 1. RLS policies for admin-managed tables
-- =============================================

-- permissions table: admins can read/write, authenticated can read
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage permissions"
  ON public.permissions FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- roles table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read roles"
  ON public.roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage roles"
  ON public.roles FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- role_permission_map
ALTER TABLE public.role_permission_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read role_permission_map"
  ON public.role_permission_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage role_permission_map"
  ON public.role_permission_map FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- user_role_map
ALTER TABLE public.user_role_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read user_role_map"
  ON public.user_role_map FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage user_role_map"
  ON public.user_role_map FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- portal_access_invites
ALTER TABLE public.portal_access_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage portal_access_invites"
  ON public.portal_access_invites FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- users table: admins need full access
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Admins can insert users"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Admins can update users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

-- companies table: admins need full access
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage companies"
  ON public.companies FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (true);

-- audit_logs: admins can read, anyone authenticated can insert
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit_logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can insert audit_logs"
  ON public.audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage app_settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read app_settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

-- exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage exchange_rates"
  ON public.exchange_rates FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read exchange_rates"
  ON public.exchange_rates FOR SELECT
  TO authenticated
  USING (true);

-- moq_rules
ALTER TABLE public.moq_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage moq_rules"
  ON public.moq_rules FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read moq_rules"
  ON public.moq_rules FOR SELECT
  TO authenticated
  USING (true);

-- pricing_slabs
ALTER TABLE public.pricing_slabs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage pricing_slabs"
  ON public.pricing_slabs FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read pricing_slabs"
  ON public.pricing_slabs FOR SELECT
  TO authenticated
  USING (true);

-- categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'super_admin')
  ));

CREATE POLICY "Authenticated can read categories"
  ON public.categories FOR SELECT
  TO authenticated
  USING (true);

-- =============================================
-- 2. Seed permissions for all 12 modules
-- =============================================
INSERT INTO public.permissions (permission_key, permission_name, module_name) VALUES
  ('client_governance.view', 'View Client Governance', 'Client Governance'),
  ('client_governance.manage', 'Manage Client Governance', 'Client Governance'),
  ('product_catalog.view', 'View Product Catalog', 'Product Catalog'),
  ('product_catalog.manage', 'Manage Product Catalog', 'Product Catalog'),
  ('pricing_matrix.view', 'View Pricing Matrix', 'Pricing Matrix'),
  ('pricing_matrix.manage', 'Manage Pricing Matrix', 'Pricing Matrix'),
  ('orders.view', 'View Orders', 'Orders'),
  ('orders.manage', 'Manage Orders', 'Orders'),
  ('production.view', 'View Production', 'Production'),
  ('production.manage', 'Manage Production', 'Production'),
  ('assembly.view', 'View Assembly', 'Assembly'),
  ('assembly.manage', 'Manage Assembly', 'Assembly'),
  ('packing.view', 'View Packing', 'Packing'),
  ('packing.manage', 'Manage Packing', 'Packing'),
  ('dispatch.view', 'View Dispatch', 'Dispatch'),
  ('dispatch.manage', 'Manage Dispatch', 'Dispatch'),
  ('finance.view', 'View Finance', 'Finance'),
  ('finance.manage', 'Manage Finance', 'Finance'),
  ('support.view', 'View Support', 'Support'),
  ('support.manage', 'Manage Support', 'Support'),
  ('settings.view', 'View Settings', 'Settings'),
  ('settings.manage', 'Manage Settings', 'Settings'),
  ('audit.view', 'View Audit Trail', 'Audit'),
  ('audit.manage', 'Manage Audit Trail', 'Audit')
ON CONFLICT DO NOTHING;

-- =============================================
-- 3. Seed default roles
-- =============================================
INSERT INTO public.roles (role_key, role_name, is_active) VALUES
  ('super_admin', 'Super Admin', true),
  ('finance_head', 'Finance Head', true),
  ('dispatch_head', 'Dispatch Head', true),
  ('sales_executive', 'Sales Executive', true),
  ('production_manager', 'Production Manager', true),
  ('assembly_manager', 'Assembly Manager', true),
  ('packing_supervisor', 'Packing Supervisor', true),
  ('support_executive', 'Support Executive', true),
  ('customer_user', 'Customer User', true)
ON CONFLICT DO NOTHING;

-- =============================================
-- 4. Add invite_status to users for employee invite tracking
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'invite_status') THEN
    ALTER TABLE public.users ADD COLUMN invite_status text DEFAULT 'active';
  END IF;
END $$;
