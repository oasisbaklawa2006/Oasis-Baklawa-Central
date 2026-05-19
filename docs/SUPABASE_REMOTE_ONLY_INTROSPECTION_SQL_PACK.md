# Remote-only drift — read-only SQL pack (Supabase SQL Editor)

**Use:** Copy **one** block at a time into the Supabase **SQL Editor**. Human review only.  
**Do not** run from automation in this task; this file is documentation.

**Hard rules**

- Every statement is a **`SELECT` only** (read-only). No `INSERT`/`UPDATE`/`DELETE`/DDL.  
- Sections **2–10** query **`information_schema`** and **`pg_catalog`** only.  
- **Section 1** lists applied migration **versions** from Supabase’s **`supabase_migrations.schema_migrations`** table. That table is **not** part of `information_schema` or `pg_catalog`, but it is the canonical place Supabase stores remote migration history; omitting it would skip the core “remote history” check. It is still a read-only **`SELECT`**.

---

## 1. Schema migration history (remote-applied versions)

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

**Optional — confirm relation via `pg_catalog` only** (no row contents):

```sql
SELECT n.nspname,
       c.relname,
       c.relkind
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'supabase_migrations'
  AND c.relname = 'schema_migrations'
  AND c.relkind = 'r';
```

---

## 2. Tables (`public`)

```sql
SELECT table_schema,
       table_name,
       table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

## 3. Columns (`public`)

```sql
SELECT table_schema,
       table_name,
       column_name,
       ordinal_position,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;
```

---

## 4. Constraints (`public`)

**Summary by type**

```sql
SELECT tc.table_schema,
       tc.table_name,
       tc.constraint_name,
       tc.constraint_type
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;
```

**Foreign keys (detail)**

```sql
SELECT tc.table_name,
       kcu.column_name,
       ccu.table_schema AS foreign_table_schema,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name,
       tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_schema = tc.constraint_schema
 AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

---

## 5. Indexes (`public`)

```sql
SELECT schemaname,
       tablename,
       indexname,
       indexdef
FROM pg_catalog.pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

---

## 6. RLS-enabled tables (`public`)

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (c.relrowsecurity OR c.relforcerowsecurity)
ORDER BY c.relname;
```

**All base tables with RLS flag (including disabled)**

```sql
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relrowsecurity DESC, c.relname;
```

---

## 7. Policies (`public`)

```sql
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

---

## 8. Functions (`public` + common Supabase schemas)

**Identity (no body)**

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args,
       l.lanname AS language
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
JOIN pg_catalog.pg_language l ON l.oid = p.prolang
WHERE n.nspname IN ('public', 'auth', 'storage', 'extensions')
ORDER BY n.nspname, p.proname;
```

**Definitions (large result — export carefully)**

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_functiondef(p.oid) AS definition
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
```

---

## 9. Triggers (`public`)

```sql
SELECT trigger_schema,
       event_object_table AS table_name,
       trigger_name,
       event_manipulation,
       action_timing,
       action_orientation,
       action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;
```

---

## 10. WhatsApp / admin / auth–related objects

Adjust `ILIKE` patterns to match your naming.

### 10a — Tables (name match)

```sql
SELECT t.table_schema,
       t.table_name,
       t.table_type
FROM information_schema.tables t
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND (
    t.table_name ILIKE '%whatsapp%'
    OR t.table_name ILIKE '%waba%'
    OR t.table_name ILIKE '%message%'
    OR t.table_name ILIKE '%conversation%'
    OR t.table_name ILIKE '%override%'
    OR t.table_name ILIKE '%suggestion%'
    OR t.table_name ILIKE '%admin%'
    OR t.table_name ILIKE '%user%'
    OR t.table_name ILIKE '%role%'
    OR t.table_name ILIKE '%session%'
  )
ORDER BY t.table_name;
```

### 10b — Columns for those tables (by name pattern)

```sql
SELECT c.table_schema,
       c.table_name,
       c.column_name,
       c.ordinal_position,
       c.data_type,
       c.is_nullable
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND (
    c.table_name ILIKE '%whatsapp%'
    OR c.table_name ILIKE '%waba%'
    OR c.table_name ILIKE '%message%'
    OR c.table_name ILIKE '%conversation%'
    OR c.table_name ILIKE '%override%'
    OR c.table_name ILIKE '%suggestion%'
    OR c.table_name ILIKE '%admin%'
    OR c.table_name ILIKE '%user%'
    OR c.table_name ILIKE '%role%'
    OR c.table_name ILIKE '%session%'
  )
ORDER BY c.table_name, c.ordinal_position;
```

### 10c — Policies on matching tables

```sql
SELECT p.schemaname,
       p.tablename,
       p.policyname,
       p.cmd,
       p.roles
FROM pg_catalog.pg_policies p
WHERE p.schemaname = 'public'
  AND (
    p.tablename ILIKE '%whatsapp%'
    OR p.tablename ILIKE '%waba%'
    OR p.tablename ILIKE '%message%'
    OR p.tablename ILIKE '%conversation%'
    OR p.tablename ILIKE '%override%'
    OR p.tablename ILIKE '%suggestion%'
    OR p.tablename ILIKE '%admin%'
    OR p.tablename ILIKE '%user%'
    OR p.tablename ILIKE '%role%'
    OR p.tablename ILIKE '%session%'
  )
ORDER BY p.tablename, p.policyname;
```

### 10d — Functions in `public` (name match)

```sql
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_args
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%whatsapp%'
    OR p.proname ILIKE '%waba%'
    OR p.proname ILIKE '%message%'
    OR p.proname ILIKE '%admin%'
    OR p.proname ILIKE '%user%'
    OR p.proname ILIKE '%role%'
    OR p.proname ILIKE '%auth%'
  )
ORDER BY p.proname;
```

### 10e — Triggers on matching tables

```sql
SELECT tr.trigger_schema,
       tr.event_object_table,
       tr.trigger_name,
       tr.event_manipulation,
       tr.action_timing
FROM information_schema.triggers tr
WHERE tr.trigger_schema = 'public'
  AND (
    tr.event_object_table ILIKE '%whatsapp%'
    OR tr.event_object_table ILIKE '%waba%'
    OR tr.event_object_table ILIKE '%message%'
    OR tr.event_object_table ILIKE '%conversation%'
    OR tr.event_object_table ILIKE '%override%'
    OR tr.event_object_table ILIKE '%suggestion%'
    OR tr.event_object_table ILIKE '%admin%'
    OR tr.event_object_table ILIKE '%user%'
    OR tr.event_object_table ILIKE '%role%'
    OR tr.event_object_table ILIKE '%session%'
  )
ORDER BY tr.event_object_table, tr.trigger_name;
```

---

*End of SQL pack.*
