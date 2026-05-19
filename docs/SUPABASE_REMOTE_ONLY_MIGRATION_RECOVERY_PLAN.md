# Remote-only migration recovery plan

**Purpose:** Plan how to recover **thirteen** migration **versions** that exist in **remote** migration history but have **no** matching `supabase/migrations/<version>_*.sql` file in this repository.  
**Scope:** Documentation and process only. **No** Supabase CLI runs, **no** new migration files, **no** `migration repair`, **no** `db push` / `db pull`, **no** deploy, **no** git push from this task.

**Source inventory:** `docs/SUPABASE_MIGRATION_DRIFT_RECONCILIATION_WORKSHEET.md` §1 (remote-only list).

---

## 1. The thirteen remote-only migration versions

| # | Version | Time (UTC) |
|---|---------|------------|
| 1 | `20260423214633` | 2026-04-23 21:46:33 |
| 2 | `20260514185811` | 2026-05-14 18:58:11 |
| 3 | `20260514185829` | 2026-05-14 18:58:29 |
| 4 | `20260514185852` | 2026-05-14 18:58:52 |
| 5 | `20260515073922` | 2026-05-15 07:39:22 |
| 6 | `20260515073940` | 2026-05-15 07:39:40 |
| 7 | `20260517072741` | 2026-05-17 07:27:41 |
| 8 | `20260517151438` | 2026-05-17 15:14:38 |
| 9 | `20260517152907` | 2026-05-17 15:29:07 |
| 10 | `20260517203808` | 2026-05-17 20:38:08 |
| 11 | `20260518074624` | 2026-05-18 07:46:24 |
| 12 | `20260518075520` | 2026-05-18 07:55:20 |
| 13 | `20260518210953` | 2026-05-18 21:09:53 |

---

## 2. Per-version recovery rows

Each row is a **tracking unit** until the version has a reviewed local SQL file (or an alternate, explicitly approved reconciliation path documented elsewhere).

| Version | Current status | Suspected source | Required evidence before reconstruction | Recovery method (in order) | Risk level |
|---------|----------------|------------------|------------------------------------------|-----------------------------|------------|
| `20260423214633` | Missing local SQL | Unknown | Who/what applied it; artifact with exact SQL or DDL delta; correlation with adjacent migrations `20260423214346` / `20260423214837` | Locate original SQL → inspect production DDL / catalog diff → compare backups → **owner confirmation** | **High** |
| `20260514185811` | Missing local SQL | Unknown | CI log, Supabase dashboard SQL history, engineer notes, or ticket linking timestamp to change set | Same | **High** |
| `20260514185829` | Missing local SQL | Unknown | Same (cluster of three timestamps suggests one session—bundle evidence) | Same | **High** |
| `20260514185852` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260515073922` | Missing local SQL | Unknown | Same (pair with next row likely same operator/run) | Same | **High** |
| `20260515073940` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260517072741` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260517151438` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260517152907` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260517203808` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260518074624` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260518075520` | Missing local SQL | Unknown | Same | Same | **High** |
| `20260518210953` | Missing local SQL | Unknown | Same | Same | **High** |

**Column definitions**

- **Suspected source:** Marked **unknown** until an owner names the pipeline (another branch, dashboard SQL, CLI from a laptop, CI job, etc.).  
- **Required evidence:** Do not author migration SQL from memory alone. Require at least one **primary** source (original script, logged SQL, or vetted diff) plus **owner confirmation** for anything inferred.  
- **Recovery method:** (1) **Locate original SQL** if it exists anywhere trustworthy. (2) If impossible, **reconstruct** from **production** introspection (DDL, policies, grants) and compare to **backups** or a **clone** so the file matches what is truly on the database. (3) **Review in PR** with a second reader. (4) **Only then** pursue aligning migration history with the rest of the drift plan (`docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`).  
- **Risk level:** **High** while provenance is unknown: wrong file contents can make future `db push` apply duplicate or destructive changes, or mask real drift.

---

## 3. Why placeholder empty migrations are dangerous

A file named `supabase/migrations/<version>_anything.sql` whose body is **empty** or **no-op** may satisfy the CLI’s **filename ↔ version** check **without** encoding what actually ran on the remote.

That breaks the contract that **migration files are replayable documentation of state transitions**. Future environments (new staging, restore, branch deploy) may **miss** DDL that production already has, or later migrations may **assume** objects exist and fail silently or badly. It also makes **audits** and **incident response** unreliable: git history no longer explains the database.

**Rule:** Every recovered file must contain SQL that is **honest** about what was applied (including idempotent guards if the objects already exist), not a hollow placeholder.

---

## 4. Why `migration repair` is dangerous without knowing what each migration did

`migration repair` mutates **migration history metadata** on the remote (or local tracking), not necessarily the physical schema. If you revert or mark versions **without** matching that to **actual** DDL:

- You can **erase** the record of real applied changes while the objects remain (or vice versa).  
- Subsequent **`db push`** may run **out-of-order** or **duplicate** operations relative to real state.  
- Teams lose a **single source of truth** between `schema_migrations` and files.

Repair may be appropriate **only** after proving a version was **erroneous** or a duplicate, with backup and sign-off—never as a shortcut to silence the CLI when the underlying change is unknown.

---

## 5. Safe recovery workflow (summary)

1. **Identify owner / source** — Assign someone to find who applied each version and from which system (dashboard, CLI, CI, other repo).  
2. **Recover original SQL if possible** — Prefer logs, saved scripts, or merge commits from the branch that applied the change.  
3. **If impossible** — Reconstruct from **production schema** (read-only inspection), cross-check **backups** or a **point-in-time clone**, and document assumptions.  
4. **Review in PR** — SQL diff, RLS, destructive statements, and ordering relative to neighbors must be reviewed like any migration.  
5. **Only then align migration history** — Together with the **local-only** pending chain and the written plan in `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`, use the approved path (typically files first; repair only with evidence).

---

## 6. C2B status

**C2B and C2 write-path work remain blocked** until every **remote-only** version is **accounted for** with honest local SQL (or a formally approved alternate reconciliation), and the overall drift picture allows a trusted apply path. Shipping write paths while thirteen remote versions lack traceable files **increases** operational and compliance risk.

---

*End of remote-only migration recovery plan.*
