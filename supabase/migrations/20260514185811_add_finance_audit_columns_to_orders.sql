-- History-only no-op for staging baseline alignment.
-- DDL already present from production schema-only dump restored in Stage 5.
-- Do not use as greenfield bootstrap.
--
-- Remote name: add_finance_audit_columns_to_orders
-- Schema objects (orders.finance_verified_by/at, indexes) match local
-- 20260515120000_orders_finance_audit.sql per Phase A introspection.

SELECT 1;
