# Supabase migration drift — resolution plan

**Purpose:** Operational plan to reconcile **local** `supabase/migrations/` with **remote** migration history so `npx supabase@latest db push` can run again (including pending **`20260518220000`** C2A audit reconciliation).  
**Scope:** Documentation only. No schema changes, no CLI drift commands, and no commits implied by this file alone.

---

## 1. Current drift summary

| Situation | Detail |
|-----------|--------|
| **Two-way drift** | The remote database records migration **versions** that **do not exist** as files in this repo, **and** this repo has migration **files** whose **versions** are **not** recorded as applied on the remote. |
| **Symptom** | `npx supabase@latest db push` **fails** with *remote migration versions not found in local migrations directory*. |
| **Impact** | **C2A** SQL is in repo (`20260518220000_...`) but **cannot be applied** via normal push until history matches. **C2B** write-path work should stay **paused** until drift is resolved under a written plan. |

---

## 2. Remote-only migration versions (on remote, missing locally)

These versions must appear as files in `supabase/migrations/` **or** be deliberately removed from remote history via an approved `repair` strategy (see option C).

| Version | Notes |
|---------|--------|
| `20260423214633` | |
| `20260514185811` | |
| `20260514185829` | |
| `20260514185852` | |
| `20260515073922` | |
| `20260515073940` | |
| `20260517072741` | |
| `20260517151438` | |
| `20260517152907` | |
| `20260517203808` | |
| `20260518074624` | |
| `20260518075520` | |
| `20260518210953` | |

*(Source: `npx supabase@latest migration list` — Remote column set, Local blank.)*

---

## 3. Local-only migration versions (in repo, not applied on remote)

These files exist under `supabase/migrations/` but the remote history row is missing until `db push` succeeds after alignment.

| Version | Typical file prefix |
|---------|---------------------|
| `20260503201343` | `20260503201343_*` |
| `20260503215926` | `20260503215926_*` |
| `20260504035656` | `20260504035656_*` |
| `20260508155100` | `20260508155100_*` |
| `20260510120000` | `20260510120000_*` |
| `20260515120000` | `20260515120000_*` |
| `20260515120001` | `20260515120001_*` |
| `20260515194500` | `20260515194500_*` |
| `20260516200000` | `20260516200000_*` |
| `20260518220000` | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` (C2A) |

*(Source: `migration list` — Local column set, Remote blank.)*

---

## 4. Why `db push` is blocked

Supabase compares **remote migration history** to **local migration filenames (version prefix)**. If the remote lists a **version** with **no matching local file**, the CLI **refuses** to apply newer local migrations to avoid applying out-of-order or unknown state.

Until every **remote-only** version is represented locally (or legitimately repaired away), **`db push` cannot proceed**.

---

## 5. Option A — Controlled `db pull` branch

**Idea:** On a **non–`main`** branch, run `supabase db pull` (when approved) to generate migration(s) that reflect the **current remote schema**, then review the diff.

| Pros | Cons |
|------|------|
| Captures **actual** remote DDL in one pass | May produce **large** or noisy SQL (policies, grants, comments) |
| Good when remote truth is authoritative | Easy to **duplicate** objects if not careful with existing files |
| Fits “remote is source of truth” | Requires strong **review** discipline |

**Mitigation:** Small PRs, split generated SQL by concern, compare to `migration list` remote-only list.

---

## 6. Option B — Manually recreate missing remote migration files

**Idea:** For each **remote-only** version, add a file `supabase/migrations/<version>_<slug>.sql` whose contents are the **exact SQL** that was applied when that version was recorded (from CI logs, runbooks, dashboard history, or DBA export).

| Pros | Cons |
|------|------|
| **Highest precision** — history matches reality | Labor-intensive |
| Avoids blind `pull` noise | Requires **recovering** original SQL for each version |
| Keeps intent explicit in git | Typos or partial SQL cause subtle mismatch |

**Mitigation:** Pair each file with evidence (link/ticket) in the PR description.

---

## 7. Option C — `migration repair` only after backup and approval

**Idea:** Use `supabase migration repair --status reverted <version> ...` to **remove** erroneous entries from remote migration history **after** proving those versions were never meant to exist or are fully superseded.

| Pros | Cons |
|------|------|
| Fixes **bad history** without inventing SQL | **Dangerous** if mis-scoped — can desync DB from truth |
| Sometimes the fastest cleanup | Requires **backup** + written sign-off |

**Never** run repair without: backup, list of versions, owner approval, and a post-check `migration list`.

---

## 8. Recommended safest option

**Prefer Option B** when you can recover SQL for remote-only versions (traceable, minimal surprise).

If SQL cannot be recovered for all remote-only rows, use **Option A on a dedicated branch** and **carefully** merge only reviewed deltas, then re-run `migration list`.

Reserve **Option C** for cases where remote history is **demonstrably wrong** and backups exist — not as a first resort.

---

## 9. Exact approval checklist (before any drift command)

Check **all** before running `db pull`, `migration repair`, or `db push` to production:

- [ ] **Owner / DBA** named as accountable for the chosen option (A, B, or C).  
- [ ] **Backup** of production DB taken (or restore point documented), *required for C*, *recommended for A/B before push*.  
- [ ] **`migration list`** output saved to ticket/PR (before + expected after).  
- [ ] **Remote-only list** — each version has a plan (file added **or** repair with justification).  
- [ ] **Local-only list** — team agrees these should apply to remote in order (no conflicting manual DDL).  
- [ ] **Staging** dry-run: `migration list` clean + `db push` to **staging** (or clone) succeeds.  
- [ ] **PR review** completed (SQL diff size, RLS, destructive statements).  
- [ ] **Rollback** narrative documented (how to revert migration files / restore DB if needed).  
- [ ] **No** production `repair` / `push` during active peak without change window.

---

## 10. C2B / C2 write-path status

**C2B and any C2 write-path (TOOL 5 / privileged Edge, RPC, etc.) remain blocked until migration drift is resolved** and `migration list` shows **no** mismatched Local/Remote rows for the versions you intend to ship. Applying write paths on a database whose migration history does not match the repo **increases** audit and rollback risk.

---

*End of resolution plan.*
