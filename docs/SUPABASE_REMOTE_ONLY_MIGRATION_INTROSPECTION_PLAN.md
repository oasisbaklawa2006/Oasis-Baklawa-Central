# Remote-only migrations — manual DB introspection plan

**Purpose:** After repo-wide evidence search found **no recoverable SQL** for the thirteen remote-only migration versions, this plan describes **how** to gather read-only facts from Postgres (e.g. Supabase SQL Editor) to support **reconstructing** honest migration files **off-line** in git—not to change the database from this document.

**Rules for this file:** Documentation only. **Do not** treat this file as permission to run `migration repair`, `db push`, or `db pull` without the separate approval path in `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`.

---

## 1. Result of repo evidence search

A full-repo search (including `git log --all` over `supabase/migrations/`, `git grep`, filename `find`, and drift/ops docs) shows:

- **No** `supabase/migrations/<version>_*.sql` files exist for any of the thirteen remote-only versions.  
- **No** committed migration body in git contains those version strings as file names or embedded IDs.  
- **Documentation only** references exist (drift report, worksheet, resolution plan, remote-only recovery plan, and `docs/ops/supabase-migration-reconciliation.md` for `20260423214633`).

**Conclusion:** There is **no recoverable SQL in the repository** for any of the thirteen remote-only migrations. External recovery (this introspection plan, CI logs, dashboard history, backups, owner interviews) is required.

---

## 2. Why manual DB introspection is required

The remote database’s **`schema_migrations`** (or equivalent) records that certain **versions** were applied, but this repo lacks the **files** that normally replay those transitions. To rebuild trustworthy `supabase/migrations/<version>_*.sql` files, someone must **observe** what is actually on the database today—tables, columns, constraints, RLS policies, functions, triggers—and correlate that with:

- Known application features (WhatsApp, auth, admin, finance, etc.),  
- Timestamps of the remote-only rows (clustering hints),  
- Any non-git evidence (logs, runbooks).

Automated `db pull` was **blocked** by migration history mismatch (`docs/SUPABASE_DB_PULL_ANALYSIS_RESULT.md`). Until history is aligned, **read-only catalog queries** in the SQL Editor are the safest way to **inspect** production (or a **clone** / read replica) without applying migrations through the CLI.

**Prefer a clone or read-only role** if your org can provide one; otherwise use production SQL Editor with extreme care (read-only `SELECT` only).

---

## 3. Safe SQL queries to run **manually later** (Supabase SQL Editor)

**Important:** Run these only when a human is at the keyboard, in the correct project, with approval. Paste **one block at a time**; review row counts and redact secrets before sharing output.

All statements below are intended as **read-only** `SELECT` against `information_schema` and `pg_catalog` only (no `INSERT`/`UPDATE`/`DELETE`/`DDL`).

### 3.1 Tables in `public` (baseline)

```sql
SELECT table_schema, table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### 3.2 “Activity” hints (not exact DDL creation time)

PostgreSQL does **not** store reliable “table created at” for every object in core catalogs. `pg_stat_user_tables` gives **approximate** recent DML **activity** (useful to spot hot tables, not migration timestamps):

```sql
SELECT schemaname, relname AS table_name,
       seq_scan, idx_scan, n_tup_ins, n_tup_upd, n_tup_del,
       last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY GREATEST(
  COALESCE(last_analyze, 'epoch'::timestamptz),
  COALESCE(last_autoanalyze, 'epoch'::timestamptz)
) DESC NULLS LAST;
```

### 3.3 Recent functions (definitions redact in PRs if sensitive)

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS args,
       l.lanname AS language
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
ORDER BY n.nspname, p.proname;
```

To pull **definitions** for review (large result sets—export carefully):

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

### 3.4 Triggers

```sql
SELECT event_object_schema AS table_schema,
       event_object_table AS table_name,
       trigger_name,
       action_timing,
       string_agg(event_manipulation, ', ' ORDER BY event_manipulation) AS events
FROM information_schema.triggers
WHERE event_object_schema = 'public'
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3;
```

### 3.5 Row Level Security (RLS) flags and policies

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY n.nspname, c.relname;
```

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### 3.6 Indexes (user tables in `public`)

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### 3.7 Constraints (PK, FK, UNIQUE, CHECK)

```sql
SELECT tc.table_schema,
       tc.table_name,
       tc.constraint_name,
       tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
```

FK detail (join columns):

```sql
SELECT tc.table_name,
       kcu.column_name,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

### 3.8 Columns for WhatsApp / auth / admin–related tables (pattern filter)

Adjust patterns to match your naming conventions.

```sql
SELECT table_schema, table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    table_name ILIKE '%whatsapp%'
    OR table_name ILIKE '%waba%'
    OR table_name ILIKE '%message%'
    OR table_name ILIKE '%override%'
    OR table_name ILIKE '%suggestion%'
    OR table_name ILIKE '%user%'
    OR table_name ILIKE '%admin%'
    OR table_name ILIKE '%role%'
    OR table_name ILIKE '%session%'
  )
ORDER BY table_name, ordinal_position;
```

### 3.9 Migration history rows (read-only peek)

**Use to correlate** remote version list with DB (names vary slightly by Supabase/Postgres version—adjust if the query errors):

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

If your project uses a different migrations table location, use the catalog query Supabase documents for your stack; keep it **`SELECT` only**.

---

## 4. SQL must be read-only `SELECT` from catalogs

- **Allowed:** `SELECT` against `information_schema.*`, `pg_catalog.*`, and documented read-only views (e.g. `pg_policies`, `pg_stat_user_tables`).  
- **Forbidden in this phase:** `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER`, `DROP`, `REPAIR`, `GRANT`, `REVOKE`, `COPY ... TO PROGRAM`, or any extension that writes or executes arbitrary code.

Introspection is for **evidence gathering**, not remediation in-session.

---

## 5. Recovered SQL → migration files (chronological order)

After introspection and any log correlation:

1. Draft **`supabase/migrations/<version>_<slug>.sql`** for each remote-only version in **strict chronological order** of the version timestamps (see `docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md` §1).  
2. Prefer **idempotent** patterns where objects may already exist (`IF NOT EXISTS`, guarded `DO` blocks) only when that matches what truly happened—**do not** empty out real DDL.  
3. Open a **PR**; second reviewer compares catalog snapshots / diffs to the proposed SQL.  
4. Only after files exist and are approved does the org proceed to the **history alignment** and apply strategy documented elsewhere (`db push` / repair **only** per approved checklist).

---

## 6. Empty placeholder migrations are forbidden

Unless **explicitly** approved in writing by the accountable owner/DBA (with documented risk acceptance), **do not** add empty or no-op migration files solely to satisfy the CLI. That desyncs git from reality and endangers future environments. See `docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md` §3.

---

## 7. `migration repair` remains forbidden until owner approval and backup

Do **not** run `supabase migration repair` to clear remote-only rows until:

- **Owner / DBA approval** with a named rollback narrative,  
- **Backup** or restore point (mandatory for repair-class changes),  
- Honest local files or a formally documented exception path exists.

See `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md` §7 and §9.

---

*End of manual DB introspection plan.*
