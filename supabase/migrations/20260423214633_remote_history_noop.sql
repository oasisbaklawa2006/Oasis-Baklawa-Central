-- History-only no-op for staging baseline alignment.
-- DDL already present from production schema-only dump restored in Stage 5.
-- Do not use as greenfield bootstrap.
--
-- Stage 6B (read-only catalog): public.auth_logs is fully covered by neighboring
-- migrations 20260423214346, 20260423214837, and 20260423221940 (columns,
-- indexes, RLS). No catalog gap on staging vs production for auth_logs.
--
-- Production migration history row exists; original SQL file was never in git.

SELECT 1;
