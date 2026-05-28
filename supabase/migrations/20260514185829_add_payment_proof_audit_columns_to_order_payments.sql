-- History-only no-op for staging baseline alignment.
-- DDL already present from production schema-only dump restored in Stage 5.
-- Do not use as greenfield bootstrap.
--
-- Remote name: add_payment_proof_audit_columns_to_order_payments
-- Schema objects (order_payments proof/verification columns) match local
-- 20260515194500_buyer_payment_receipt_and_storage.sql PART A per Phase A.

SELECT 1;
