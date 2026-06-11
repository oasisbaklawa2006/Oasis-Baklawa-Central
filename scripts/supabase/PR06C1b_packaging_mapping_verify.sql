-- =============================================================================
-- PR06C1b Packaging Product Approve Mapping — Post-Apply Verification
-- =============================================================================
-- Purpose   : Read-only checks to confirm migration
--             20260610231247_pr06c1b_packaging_product_approve_mapping.sql
--             applied correctly to project tcxvcatsqqertcnycuop.
-- Run in    : Supabase SQL Editor → project tcxvcatsqqertcnycuop
--             (SQL Editor runs as postgres / service-role)
-- Safe      : SELECT only — no mutations
-- =============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1 — Migration history record
-- ---------------------------------------------------------------------------
-- Expected: exactly one row with version = '20260610231247'
SELECT
  version,
  name
FROM   supabase_migrations.schema_migrations
WHERE  version = '20260610231247';
-- PASS: 1 row returned, name contains 'pr06c1b_packaging_product_approve_mapping'
-- FAIL: 0 rows — migration not recorded

-- ---------------------------------------------------------------------------
-- SECTION 2 — Tables exist
-- ---------------------------------------------------------------------------
SELECT
  table_name,
  table_type
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN ('catalogue_tag_drafts', 'catalogue_alias_drafts')
ORDER  BY table_name;
-- PASS: 2 rows — catalogue_alias_drafts, catalogue_tag_drafts (both BASE TABLE)
-- FAIL: 0 or 1 row — at least one draft table is missing

-- ---------------------------------------------------------------------------
-- SECTION 3 — source_mapping_id column exists on catalogue_alias_drafts
-- ---------------------------------------------------------------------------
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'catalogue_alias_drafts'
  AND  column_name  = 'source_mapping_id';
-- PASS: 1 row — data_type = 'uuid', is_nullable = 'YES'
-- FAIL: 0 rows — column not added; column addition step did not execute

-- ---------------------------------------------------------------------------
-- SECTION 4 — FK constraint: source_mapping_id → catalogue_product_mappings.id
-- ---------------------------------------------------------------------------
SELECT
  tc.constraint_name,
  kcu.column_name         AS fk_column,
  ccu.table_name          AS referenced_table,
  ccu.column_name         AS referenced_column,
  rc.delete_rule
FROM   information_schema.table_constraints        tc
JOIN   information_schema.key_column_usage         kcu
       ON  tc.constraint_name = kcu.constraint_name
       AND tc.table_schema    = kcu.table_schema
JOIN   information_schema.constraint_column_usage  ccu
       ON  ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema    = tc.table_schema
JOIN   information_schema.referential_constraints  rc
       ON  rc.constraint_name  = tc.constraint_name
WHERE  tc.constraint_type = 'FOREIGN KEY'
  AND  tc.table_schema    = 'public'
  AND  tc.table_name      = 'catalogue_alias_drafts'
  AND  kcu.column_name    = 'source_mapping_id';
-- PASS: 1 row — referenced_table = catalogue_product_mappings,
--              referenced_column = id, delete_rule = SET NULL
-- FAIL: 0 rows — FK not present

-- ---------------------------------------------------------------------------
-- SECTION 5 — catalogue_product_mappings referenced table still healthy
-- ---------------------------------------------------------------------------
SELECT
  relname  AS table_name,
  relrowsecurity
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  relname   = 'catalogue_product_mappings';
-- PASS: 1 row — relrowsecurity = true
-- FAIL: 0 rows — Phase 25B table missing (upstream dependency problem)

-- ---------------------------------------------------------------------------
-- SECTION 6 — Indexes exist
-- ---------------------------------------------------------------------------
SELECT
  indexname,
  indexdef
FROM   pg_indexes
WHERE  schemaname = 'public'
  AND  indexname IN (
         'idx_catalogue_tag_drafts_status',
         'idx_catalogue_tag_drafts_target_record',
         'idx_catalogue_alias_drafts_status',
         'idx_catalogue_alias_drafts_source_mapping'
       )
ORDER  BY indexname;
-- PASS: 4 rows
-- WARN: 3 rows — idx_catalogue_alias_drafts_source_mapping may be absent if
--       table had no pre-existing rows and partial index deferred; re-run CREATE INDEX

-- ---------------------------------------------------------------------------
-- SECTION 7 — RLS enabled on both tables
-- ---------------------------------------------------------------------------
SELECT
  relname          AS table_name,
  relrowsecurity   AS rls_enabled
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public'
  AND  relname IN ('catalogue_tag_drafts', 'catalogue_alias_drafts')
ORDER  BY relname;
-- PASS: 2 rows — both relrowsecurity = true
-- FAIL: any row with relrowsecurity = false — RLS not enabled

-- ---------------------------------------------------------------------------
-- SECTION 8 — RLS policies: correct set on both tables
-- ---------------------------------------------------------------------------
SELECT
  tablename,
  policyname,
  cmd,
  roles
FROM   pg_policies
WHERE  schemaname = 'public'
  AND  tablename IN ('catalogue_tag_drafts', 'catalogue_alias_drafts')
ORDER  BY tablename, policyname;
-- PASS: at least 4 rows:
--   catalogue_alias_drafts | catalogue_alias_drafts_select_internal | SELECT | {authenticated}
--   catalogue_alias_drafts | catalogue_alias_drafts_write_internal  | ALL    | {authenticated}
--   catalogue_tag_drafts   | catalogue_tag_drafts_select_internal   | SELECT | {authenticated}
--   catalogue_tag_drafts   | catalogue_tag_drafts_write_internal    | ALL    | {authenticated}
-- NOTE: additional C1a policies may also appear — that is acceptable

-- ---------------------------------------------------------------------------
-- SECTION 9 — GRANT check: authenticated role has SELECT
-- ---------------------------------------------------------------------------
SELECT
  grantee,
  table_name,
  privilege_type
FROM   information_schema.role_table_grants
WHERE  table_schema = 'public'
  AND  table_name IN ('catalogue_tag_drafts', 'catalogue_alias_drafts')
  AND  grantee IN ('authenticated', 'service_role')
ORDER  BY table_name, grantee, privilege_type;
-- PASS: authenticated has SELECT on both; service_role has multiple privileges

-- ---------------------------------------------------------------------------
-- SECTION 10 — C1a RPCs still present and accessible
-- ---------------------------------------------------------------------------
SELECT
  routine_name,
  routine_type,
  data_type AS return_type,
  security_type
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN (
         'approve_catalogue_tag_draft',
         'approve_catalogue_alias_draft',
         'reject_catalogue_tag_draft',
         'reject_catalogue_alias_draft'
       )
ORDER  BY routine_name;
-- PASS: 4 rows — all four RPCs present
-- FAIL: 0 rows — C1a RPCs missing; approval UI will return errors on all actions

-- ---------------------------------------------------------------------------
-- SECTION 11 — status CHECK constraint values
-- ---------------------------------------------------------------------------
SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM   information_schema.table_constraints        tc
JOIN   information_schema.check_constraints        cc
       ON cc.constraint_name = tc.constraint_name
WHERE  tc.table_schema = 'public'
  AND  tc.table_name IN ('catalogue_tag_drafts', 'catalogue_alias_drafts')
  AND  tc.constraint_type = 'CHECK'
  AND  cc.check_clause LIKE '%pending_approval%'
ORDER  BY tc.table_name;
-- PASS: 2 rows — both tables have status CHECK including 'pending_approval'

-- ---------------------------------------------------------------------------
-- SECTION 12 — Upstream Phase 25B mapping table row count (informational)
-- ---------------------------------------------------------------------------
SELECT
  sync_status,
  count(*) AS row_count
FROM   public.catalogue_product_mappings
GROUP  BY sync_status
ORDER  BY sync_status;
-- Informational only — documents how many mapped products are synced vs pending.
-- No PASS/FAIL: empty result means no products have been synced yet (normal for fresh env).

-- ---------------------------------------------------------------------------
-- SECTION 13 — No rows accidentally inserted into draft tables by migration
-- ---------------------------------------------------------------------------
SELECT
  'catalogue_tag_drafts'   AS table_name,
  count(*)                 AS row_count
FROM   public.catalogue_tag_drafts
UNION ALL
SELECT
  'catalogue_alias_drafts',
  count(*)
FROM   public.catalogue_alias_drafts;
-- PASS: both tables have 0 rows (migration is DDL-only, no data inserted)
-- WARN: non-zero rows means pre-existing C1a data — acceptable, do not delete

-- =============================================================================
-- END OF VERIFICATION SCRIPT
-- All sections above are SELECT-only. No schema or data changes are made.
-- =============================================================================
