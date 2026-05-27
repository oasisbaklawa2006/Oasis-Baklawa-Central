-- History-only no-op for staging baseline alignment.
-- DDL already present from production schema-only dump restored in Stage 5.
-- Do not use as greenfield bootstrap.
--
-- Remote name: add_finance_exec_rls_policies
-- Stage 6B catalog proof (production + staging): policies on public.orders:
--   finance_exec_read_all_orders (SELECT)
--     USING ((auth.jwt() ->> 'role') = 'finance_exec')
--   finance_exec_update_payment_fields (UPDATE)
--     USING / WITH CHECK ((auth.jwt() ->> 'role') = 'finance_exec')
-- Not present in local 20260515194500_* (buyer-centric RLS only).

SELECT 1;
