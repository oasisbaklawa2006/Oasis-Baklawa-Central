# Supabase `db pull` analysis result

**Purpose:** Record the outcome of a controlled **`db pull`** attempt for drift analysis (read/export intent only). This document does **not** change schema, run repairs, or apply migrations.

---

## 1. Branch used

`chore/supabase-db-pull-analysis`

*(Created from up-to-date `main` for isolated analysis; no commits were made as part of that setup for this write-up.)*

---

## 2. Command run

```bash
npx supabase@latest db pull --schema public
```

---

## 3. Result

**Failed** with a **migration history mismatch** between the **remote** migration history and **local** files under `supabase/migrations/`.

The Supabase CLI refused to proceed with `db pull` and exited with a non-zero status after connecting to the remote database. It suggested `supabase migration repair` subcommands as one possible remediation path; those were **out of scope** for this analysis and were **not** executed.

---

## 4. No files created or modified

After the failed command, the git working tree showed **no** new or changed tracked files: **no** migration file was generated, and **no** other repo artifacts were written by this `db pull` attempt.

---

## 5. No remote database changes

`db pull` is intended to **introspect** the remote database and **emit** local migration/schema artifacts. This run **failed before** any local export was produced.

There is **no** indication that remote **schema** or **data** was altered by this command. (Operations that **do** change remote metadata or apply DDL—such as **`migration repair`** or **`db push`**—were not run as part of this analysis.)

---

## 6. Why `db pull` cannot be used directly (here)

Supabase ties **remote migration history** to **local migration filenames** (version prefixes). When the remote lists migration **versions** that **do not exist** as files in `supabase/migrations/`, the CLI treats the state as **unsafe** for automated pull/push flows.

Until **local files match remote-recorded versions** (or an **explicit, approved** history reconciliation strategy is completed), **`db pull`** will continue to **fail early** with the same class of error. It is not a drop-in “sync remote into repo” step while two-way drift persists.

---

## 7. Conclusion

The **safest remaining paths** are:

1. **Manual reconciliation:** For each **remote-only** version, recover the **exact SQL** that was applied and add matching `supabase/migrations/<version>_*.sql` files under review (see `docs/SUPABASE_MIGRATION_DRIFT_RECONCILIATION_WORKSHEET.md` and `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md` — Option B), **or**
2. **Explicit approved repair:** Use `migration repair` **only** under backup, named ownership, and written approval (Option C), never as a blind fix.

A successful `db pull` (Option A) remains **secondary** to resolving the **history ↔ files** mismatch above.

---

## 8. C2B status

**C2B (and C2 write-path work) remains blocked** until migration drift is reconciled and a trusted apply path (for example, aligned `migration list` followed by approved `db push` where appropriate) is established. This failed `db pull` does not unblock that work.

---

*End of analysis result.*
