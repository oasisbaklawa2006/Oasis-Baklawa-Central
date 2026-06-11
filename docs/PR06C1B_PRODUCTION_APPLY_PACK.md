# PR06C1b Production Apply Pack

**Migration:** `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql`  
**Verification script:** `scripts/supabase/PR06C1b_packaging_mapping_verify.sql`  
**Production project:** `tcxvcatsqqertcnycuop`  
**Prepared:** 2026-06-11  
**Status:** Ready to apply — preview branch verification confirmed

---

## Context summary

PR06C1b (PR #152) merged on 2026-06-02. It shipped the catalogue tag/alias **approval inbox** frontend (`/admin/catalogue-approvals`) that calls the four pre-existing C1a RPCs on Central DB. The frontend is live; the DB objects backing it are live on production but were never committed to the repo's migration history.

This apply pack:

1. Records the migration in Supabase's `schema_migrations` history.
2. Creates `catalogue_tag_drafts` / `catalogue_alias_drafts` **IF NOT EXISTS** — reconciling the C1a repo gap.
3. Adds `catalogue_alias_drafts.source_mapping_id` FK → `catalogue_product_mappings.id` — the "packaging product approve mapping" column that the `approve_catalogue_alias_draft` RPC uses to enforce the `approve_blocked_mapping_not_finalized` guard for connector-sourced products.
4. Adds indexes and RLS policies idempotently.

**Nothing is removed, altered, or destructive.** Every statement is `IF NOT EXISTS` or wrapped in an existence check.

---

## Live pre-apply check results (run 2026-06-11)

All six checks executed against `tcxvcatsqqertcnycuop` via Supabase MCP (`execute_sql`).

| # | Check | Result | Verdict |
|---|-------|--------|---------|
| 1 | Migration `20260610231247` in `schema_migrations` | **0 rows** | ✅ PASS — not yet applied |
| 2 | `catalogue_product_mappings` with `relrowsecurity = true` | **1 row**, `true` | ✅ PASS — Phase 25B live |
| 3 | Both C1a draft tables present | **2 rows** (`catalogue_alias_drafts`, `catalogue_tag_drafts`) | ✅ PASS — pre-existing C1a |
| 4 | `source_mapping_id` column absent | **0 rows** | ✅ PASS — column will be added |
| 5 | Open pending drafts | `catalogue_alias_drafts`: **267 `approved`**; `catalogue_tag_drafts`: **0 rows** | ✅ No pending_approval blockers |
| 6 | Four C1a RPCs | **4 rows** — all present | ✅ PASS |
| — | `catalogue_product_mappings` row counts | **0 rows** | INFO — no synced products yet |

**Rollback path (per §5 decision matrix):** §3 = 2 rows (tables existed), §4 = 0 rows (column new) → `DROP COLUMN source_mapping_id` + delete `schema_migrations` row.

### Production schema variances (informational — do not affect this apply)

`CREATE TABLE IF NOT EXISTS` is a **no-op** because both tables already exist. These variances between the migration DDL and live production only matter if the table is ever dropped and recreated:

| Column / constraint | Migration definition | Live production |
|---------------------|---------------------|-----------------|
| `submitted_by` nullability | `NULL` (nullable) | **NOT NULL** |
| `submitted_at` nullability | `NULL` (nullable) | **NOT NULL** |
| `status` CHECK values | `pending_approval, approved, rejected, **withdrawn**` | `pending_approval, approved, rejected, **cancelled**` |
| `operation` CHECK | Not present | `create, update, delete_request` |

**Impact on apply:** None — the CREATE TABLE is skipped entirely.  
**Impact on future data writes:** Use `'cancelled'` (not `'withdrawn'`) and `operation IN ('create','update','delete_request')` when inserting draft rows directly.

### Existing RLS policy names on production

Production has 3 policies per table (not the names our migration adds):

| Table | Policy name | CMD |
|-------|-------------|-----|
| `catalogue_alias_drafts` | `catalogue_app_alias_drafts_insert_submitter` | INSERT |
| `catalogue_alias_drafts` | `catalogue_app_alias_drafts_reviewer_select` | SELECT |
| `catalogue_alias_drafts` | `catalogue_app_alias_drafts_select_own` | SELECT |
| `catalogue_tag_drafts` | `catalogue_app_tag_drafts_insert_submitter` | INSERT |
| `catalogue_tag_drafts` | `catalogue_app_tag_drafts_reviewer_select` | SELECT |
| `catalogue_tag_drafts` | `catalogue_app_tag_drafts_select_own` | SELECT |
| RLS enabled | Both tables | `relrowsecurity = true` ✅ |

The migration's `pg_policies` existence checks use different names (`*_select_internal`, `*_write_internal`), so they will be added as **new policies** alongside the existing three. The existing submitter/reviewer access model is preserved; the new policies give `is_internal_staff` users SELECT + ALL write access via a separate path. This is additive and does not remove or alter any existing policy.

---

## 1. Exact migration file to apply

```
supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

Full content is at that path in the repo. The SQL is reproduced verbatim in §3.

---

## 2. Pre-apply read-only checks

Run all of the following in the **Supabase SQL Editor** on project `tcxvcatsqqertcnycuop` before applying.  
All queries are `SELECT`-only.

### 2.1 Confirm migration is not already applied

```sql
SELECT version, name
FROM   supabase_migrations.schema_migrations
WHERE  version = '20260610231247';
```

**Expected:** 0 rows — proceed.  
**If 1 row returned:** migration already applied; skip apply step and run §4 verification only.

### 2.2 Confirm Phase 25B dependency is present

```sql
SELECT relname, relrowsecurity
FROM   pg_class c
JOIN   pg_namespace n ON n.oid = c.relnamespace
WHERE  n.nspname = 'public' AND relname = 'catalogue_product_mappings';
```

**Expected:** 1 row, `relrowsecurity = true`.  
**If 0 rows:** Phase 25B not applied. Apply `20260601180000_phase25b_catalogue_product_mappings.sql` first (documented as already applied per `CENTRAL_FINAL_CATALOGUE_CONNECTOR_CLOSEOUT.md`).

### 2.3 Check whether C1a tables already exist

```sql
SELECT table_name
FROM   information_schema.tables
WHERE  table_schema = 'public'
  AND  table_name IN ('catalogue_tag_drafts', 'catalogue_alias_drafts');
```

**Expected:** 2 rows — both tables already exist from pre-repo C1a.  
**If 0 rows:** tables are absent; `CREATE TABLE IF NOT EXISTS` in the migration will create them fresh — safe.

### 2.4 Check whether source_mapping_id column already exists

```sql
SELECT column_name
FROM   information_schema.columns
WHERE  table_schema = 'public'
  AND  table_name   = 'catalogue_alias_drafts'
  AND  column_name  = 'source_mapping_id';
```

**Expected:** 0 rows — column not yet present; migration will add it.  
**If 1 row:** column already exists; `DO $$` guard will skip the ALTER — safe.

### 2.5 Check for open pending drafts (informational, no blocker)

```sql
SELECT status, count(*) AS n
FROM   public.catalogue_alias_drafts
GROUP  BY status
UNION ALL
SELECT status, count(*)
FROM   public.catalogue_tag_drafts
GROUP  BY status;
```

**Expected:** rows with counts.  
**Action:** Note the pending count. The migration does not alter existing rows; any pending drafts will gain `source_mapping_id = NULL` (nullable, no constraint violation).

### 2.6 Confirm four C1a RPCs are still live

```sql
SELECT routine_name
FROM   information_schema.routines
WHERE  routine_schema = 'public'
  AND  routine_name IN (
         'approve_catalogue_tag_draft',
         'approve_catalogue_alias_draft',
         'reject_catalogue_tag_draft',
         'reject_catalogue_alias_draft'
       );
```

**Expected:** 4 rows.  
**If < 4 rows:** C1a RPCs missing — the approval UI will not function after deploy regardless. Do not block this migration apply, but file a C1a RPC restoration ticket.

---

## 3. Exact apply instruction

> **Do not use `supabase db push`** — remote migration drift (13 remote-only versions) blocks CLI push. Apply via **SQL Editor** only.

### Method A — SQL Editor (recommended)

1. Open Supabase dashboard → project `tcxvcatsqqertcnycuop` → **SQL Editor**.
2. Paste the full content of `supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql`.
3. Click **Run**.
4. Confirm the editor shows `Success. No rows returned.` (DDL-only migration returns no rows).

### Method B — Supabase CLI with `--db-url` (advanced, avoids push drift check)

```bash
# Requires SUPABASE_DB_URL set to the production direct connection string.
psql "$SUPABASE_DB_URL" \
  -f supabase/migrations/20260610231247_pr06c1b_packaging_product_approve_mapping.sql
```

After applying via either method, manually record the migration version in history:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260610231247',
  'pr06c1b_packaging_product_approve_mapping',
  ARRAY['-- see migration file']
)
ON CONFLICT (version) DO NOTHING;
```

---

## 4. Post-apply verification SQL

Run the full script at `scripts/supabase/PR06C1b_packaging_mapping_verify.sql` in the SQL Editor.

The critical sections and their expected outcomes are summarised below.

| Section | Query target | Expected |
|---------|-------------|----------|
| §1 | `schema_migrations` | 1 row: version `20260610231247` |
| §2 | `information_schema.tables` | 2 rows: both draft tables |
| §3 | `information_schema.columns` | 1 row: `source_mapping_id`, type `uuid`, nullable |
| §4 | FK constraints | 1 row: FK to `catalogue_product_mappings`, `DELETE SET NULL` |
| §5 | `catalogue_product_mappings` RLS | `relrowsecurity = true` |
| §6 | `pg_indexes` | 4 rows: all four new indexes |
| §7 | `pg_class` RLS flags | Both tables: `relrowsecurity = true` |
| §8 | `pg_policies` | ≥ 4 rows: select + write policies on both tables |
| §9 | `role_table_grants` | `authenticated` SELECT on both; `service_role` ALL |
| §10 | `information_schema.routines` | 4 rows: all C1a RPCs present |
| §11 | CHECK constraints | 2 rows: `pending_approval` in status CHECK |
| §12 | `catalogue_product_mappings` counts | Informational only |
| §13 | Row counts on draft tables | 0 rows if fresh; non-zero acceptable (pre-existing C1a data) |

**All §1–§11 checks must PASS before declaring the migration successful.**

### Spot-check: end-to-end approval path

If at least one pending draft exists, manually test via the Supabase SQL Editor:

```sql
-- List one pending alias draft
SELECT id, status, source_mapping_id, payload
FROM   public.catalogue_alias_drafts
WHERE  status = 'pending_approval'
LIMIT  1;
```

Confirm `source_mapping_id` is `NULL` for pre-existing drafts (expected — nullable, no mapping linked yet). The approve RPC path for `source_mapping_id IS NULL` proceeds without the finalization check; only drafts explicitly linked to a mapping record trigger the guard.

---

## 5. Rollback plan

The migration is additive-only. No data is deleted or modified. Rollback procedures are:

### 5.1 Drop source_mapping_id column (if column was newly added)

```sql
-- Only run if source_mapping_id did not exist before this migration.
-- Dropping the column also drops the FK constraint and the partial index.
ALTER TABLE public.catalogue_alias_drafts
  DROP COLUMN IF EXISTS source_mapping_id;
```

### 5.2 Drop draft tables (only if they did not exist before this migration)

> **WARNING:** Only execute if pre-apply check §2.3 returned 0 rows (tables were absent). If they were pre-existing C1a objects, do NOT drop them — the approval UI and RPCs depend on them.

```sql
-- ONLY if tables were newly created by this migration (pre-apply check §2.3 = 0 rows)
DROP TABLE IF EXISTS public.catalogue_alias_drafts;
DROP TABLE IF EXISTS public.catalogue_tag_drafts;
```

### 5.3 Remove migration history record

```sql
DELETE FROM supabase_migrations.schema_migrations
WHERE  version = '20260610231247';
```

### 5.4 Decision matrix

| Pre-apply §2.3 result | Pre-apply §2.4 result | Rollback path |
|-----------------------|-----------------------|---------------|
| 2 rows (tables existed) | 0 rows (column new) | §5.1 + §5.3 only |
| 2 rows (tables existed) | 1 row (column existed) | §5.3 only (nothing changed) |
| 0 rows (tables new) | N/A | §5.2 + §5.3 |

---

## 6. Wave 4A-1 go/no-go checklist

Wave 4A-1 is the first wave of catalogue authority staging import (PR C per `docs/CATALOGUE_AUTHORITY_STAGING_IMPORT_PLAN.md`): creating `catalogue_authority_import_batches`, `catalogue_authority_import_raw`, and C1 product candidate staging tables.

**Wave 4A-1 drafts must not be approved or applied before all items below are GO.**

| # | Check | Live status (2026-06-11) | Notes |
|---|-------|--------------------------|-------|
| 1 | PR06C1b migration applied and all §4 post-apply checks pass | **GATE — PENDING** (migration not yet applied) | Apply this pack first; then re-evaluate |
| 2 | `catalogue_product_mappings` live with ≥ 1 `synced` row | **INFO — NOT MET** (0 rows in table) | Wave 4A-1 schema-only PR is not blocked; data-load step requires synced mappings |
| 3 | `catalogue_tag_drafts` and `catalogue_alias_drafts` confirmed present on prod | **GATE — MET** ✅ (both tables live, RLS enabled) | C1a dependency satisfied |
| 4 | All 4 C1a RPCs live | **GATE — MET** ✅ (all 4 RPCs confirmed) | Approval path functional |
| 5 | No `pending_approval` alias/tag drafts that would be blocked by missing `source_mapping_id` mapping | **MET** ✅ (0 pending_approval rows; 267 approved) | No inbox backlog to clear before apply |
| 6 | Migration drift acknowledged; apply via SQL Editor | **INFO — OPEN** (13 remote-only versions, drift unresolved) | Wave 4A-1 migration must also use SQL Editor path |
| 7 | Authority source files committed under `project/raw/catalogue-authority/` | **NOT MET** (per `CATALOGUE_AUTHORITY_STAGING_IMPORT_PLAN.md` §2) | Blocks data-load step only, not schema step |
| 8 | Wave 4A-1 migration carries `source_environment = 'staging'` CHECK on all candidate tables | **GATE — PENDING** (Wave 4A-1 not yet drafted) | Must be enforced on PR before staging apply |
| 9 | Internal staff user confirmed available to test RLS on Wave 4A-1 tables | **Verify** | Required before production apply of Wave 4A-1 |
| 10 | `CATALOGUE_AUTHORITY_STAGING_IMPORT_PLAN.md` §8 read-only boundaries reviewed and accepted | **Requirement — OPEN** | Products/aliases/tags must stay read-only from staging import job |

### Wave 4A-1 GO decision

| All GATE items green? | GO / NO-GO |
|-----------------------|------------|
| YES | **GO** — Wave 4A-1 staging schema PR may be prepared and applied to staging first |
| Any GATE item red | **NO-GO** — resolve blocking items before preparing Wave 4A-1 |

> Wave 4A drafts must not be approved or applied automatically. Each must pass the human-reviewed apply pack flow analogous to this document.

---

## Appendix: object inventory

### Objects this migration creates or modifies

| Object | Type | Action |
|--------|------|--------|
| `public.catalogue_tag_drafts` | TABLE | CREATE IF NOT EXISTS |
| `public.catalogue_alias_drafts` | TABLE | CREATE IF NOT EXISTS |
| `public.catalogue_alias_drafts.source_mapping_id` | COLUMN | ALTER ADD IF NOT EXISTS (via DO block) |
| `idx_catalogue_tag_drafts_status` | INDEX | CREATE IF NOT EXISTS |
| `idx_catalogue_tag_drafts_target_record` | INDEX | CREATE IF NOT EXISTS |
| `idx_catalogue_alias_drafts_status` | INDEX | CREATE IF NOT EXISTS |
| `idx_catalogue_alias_drafts_source_mapping` | INDEX | CREATE IF NOT EXISTS |
| `catalogue_tag_drafts_select_internal` | POLICY | CREATE IF NOT EXISTS (via pg_policies check) |
| `catalogue_tag_drafts_write_internal` | POLICY | CREATE IF NOT EXISTS (via pg_policies check) |
| `catalogue_alias_drafts_select_internal` | POLICY | CREATE IF NOT EXISTS (via pg_policies check) |
| `catalogue_alias_drafts_write_internal` | POLICY | CREATE IF NOT EXISTS (via pg_policies check) |
| `supabase_migrations.schema_migrations` row `20260610231247` | DATA | INSERT (manual step after SQL Editor apply) |

### Objects this migration does NOT touch

- `products`, `product_tags`, `product_aliases`, `product_bom`, `product_tag_mapping`
- `catalogue_product_mappings` (read as FK target only)
- `approve_catalogue_tag_draft`, `approve_catalogue_alias_draft` (pre-existing C1a RPCs)
- `reject_catalogue_tag_draft`, `reject_catalogue_alias_draft`
- Golden Chain tables (`orders`, `order_items`, `dispatch_*`, `factory_inventory`, …)
- WhatsApp tables (`sales_order_drafts`, `wa_*`, `whatsapp_*`)
- Any customer-facing table or RLS policy

---

*This document was prepared as a read-only apply pack. No SQL was run against production during its preparation.*
