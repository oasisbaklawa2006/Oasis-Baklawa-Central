# Remote-only migration drift — manual SQL confirmation

**Purpose:** Record the outcome of a **manual**, **read-only** query run in the Supabase SQL Editor against **`supabase_migrations.schema_migrations`**. This file does **not** change schema, migration files, or remote state.

**Date / context:** Confirmation captured after manual execution (documentation update only in git).

---

## 1. Manual SQL query used

```sql
SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

*(Same query as in `docs/SUPABASE_REMOTE_ONLY_INTROSPECTION_SQL_PACK.md` §1.)*

---

## 2. Migration count

**101** rows returned from `supabase_migrations.schema_migrations` for this confirmation run.

---

## 3. Confirmed remote-only versions (no matching local file in repo)

These **version** values appear in **remote** migration history; the repository still lacks `supabase/migrations/<version>_*.sql` for each (see drift worksheet / recovery plan). They were **re-confirmed** against the query result set:

| Version |
|---------|
| `20260423214633` |
| `20260514185811` |
| `20260514185829` |
| `20260514185852` |
| `20260515073922` |
| `20260515073940` |
| `20260517072741` |
| `20260517151438` |
| `20260517152907` |
| `20260517203808` |
| `20260518074624` |
| `20260518075520` |
| `20260518210953` |

**Count:** 13 remote-only versions (unchanged vs prior drift documentation).

---

## 4. Execution note

This confirmation used **read-only `SELECT`** only. No `INSERT`, `UPDATE`, `DELETE`, DDL, Supabase CLI **`db push` / `db pull`**, or **`migration repair`** was run as part of recording this result.

---

## 5. C2B status

**C2B and C2 write-path work remain blocked** until remote-only migrations are reconciled with honest local SQL (or an explicitly approved alternate path) and the overall drift plan allows a trusted apply workflow.

---

*End of manual SQL confirmation record.*
