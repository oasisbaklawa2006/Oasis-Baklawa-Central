# Supabase migration drift report

**Purpose:** Document why **`npx supabase@latest db push`** failed and how migration history diverges between **this repository** and the **linked production** project (`tcxvcatsqqertcnycuop` per `supabase/config.toml`).  
**Audience:** Engineers unblocking Sprint C2 schema work without guessing at `repair` / `pull` / `push`.

This file is **documentation only**. It does not change schema, run repairs, or apply migrations.

---

## 1. Why `db push` failed

`npx supabase@latest db push` connected to the remote database but failed with:

**“Remote migration versions not found in local migrations directory.”**

Meaning: the remote **`schema_migrations`** (or equivalent) records **version timestamps** that **do not have** a matching file under `supabase/migrations/` in this repo. Supabase refuses to apply new local migrations until that history is consistent with the files on disk (or deliberately repaired under a controlled process).

---

## 2. Remote-only migration versions (on remote, not on local)

These versions appear in **`npx supabase@latest migration list`** under **Remote** with a **blank Local** column (as of the report that generated this document):

| Version      | Time (UTC) |
|-------------|------------|
| `20260423214633` | 2026-04-23 21:46:33 |
| `20260514185811` | 2026-05-14 18:58:11 |
| `20260514185829` | 2026-05-14 18:58:29 |
| `20260514185852` | 2026-05-14 18:58:52 |
| `20260515073922` | 2026-05-15 07:39:22 |
| `20260515073940` | 2026-05-15 07:39:40 |
| `20260517072741` | 2026-05-17 07:27:41 |
| `20260517151438` | 2026-05-17 15:14:38 |
| `20260517152907` | 2026-05-17 15:29:07 |
| `20260517203808` | 2026-05-17 20:38:08 |
| `20260518074624` | 2026-05-18 07:46:24 |
| `20260518075520` | 2026-05-18 07:55:20 |
| `20260518210953` | 2026-05-18 21:09:53 |

**Implication:** Something (CLI, dashboard SQL, another branch, or another machine) applied migrations **on the remote** that are **not represented** in this repo’s `supabase/migrations/` tree.

---

## 3. Local-only migration versions (in repo, not on remote)

These versions appear under **Local** with a **blank Remote** column:

| Version      | Time (UTC) |
|-------------|------------|
| `20260503201343` | 2026-05-03 20:13:43 |
| `20260503215926` | 2026-05-03 21:59:26 |
| `20260504035656` | 2026-05-04 03:56:56 |
| `20260508155100` | 2026-05-08 15:51:00 |
| `20260510120000` | 2026-05-10 12:00:00 |
| `20260515120000` | 2026-05-15 12:00:00 |
| `20260515120001` | 2026-05-15 12:00:01 |
| `20260515194500` | 2026-05-15 19:45:00 |
| `20260516200000` | 2026-05-16 20:00:00 |
| `20260518220000` | 2026-05-18 22:00:00 |

**Implication:** This repo contains migration files that have **not** been applied to the linked remote via the normal migration pipeline (at least not under the same version rows).

---

## 4. C2A reconciliation migration `20260518220000`

- **File:** `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`  
- **Git:** committed and pushed to **`main`** as part of normal development flow.  
- **Remote migration history:** **`20260518220000` is still pending** on the linked database (Local column populated, Remote column empty in `migration list` at time of reporting).

So: **source of truth exists in the repo**, but **`db push` has not successfully applied** it to production while drift persists.

---

## 5. Audit tables vs C2A migration

**Production already contains** `public.whatsapp_override_log` and `public.whatsapp_suggestions_log` (verified separately via SQL against the live project).

The **C2A reconciliation** migration is designed to be **idempotent** (`CREATE TABLE IF NOT EXISTS`, safe FK/index/policy steps) so that applying it on production should **align** repo history with existing objects rather than drop/recreate them.

Until **`db push`** (or an equivalent approved apply path) succeeds, the **repo migration file** and **remote migration history** remain **out of sync**, even if the physical tables already exist.

---

## 6. Do **not** run `migration repair` blindly

`supabase migration repair` (especially `--status reverted`) **mutates migration history metadata** on the remote. Wrong targets can:

- Hide real applied migrations from the team, or  
- Allow `db push` to run migrations **out of order** relative to actual schema state.

**Only** use `repair` with a written plan, backups, and owner approval.

---

## 7. Do **not** run `db pull` blindly

`supabase db pull` can generate or alter migration artifacts from the **current remote schema**. Without review:

- You may commit **large, unintended diffs** (policies, grants, extensions).  
- You may **duplicate** objects already represented under different local filenames.  
- You may merge **non–version-controlled** remote hotfixes in a way that is hard to review.

**Always** use a **dedicated branch**, diff review, and a second pair of eyes when reconciling drift.

---

## 8. Recommended safe options (choose explicitly)

| Option | Description |
|--------|-------------|
| **A. Export / commit matching SQL files for remote-only versions** | For each **remote-only** timestamp, obtain the exact SQL that was applied (from runbooks, CI logs, or `pg_dump` / dashboard history), add **`supabase/migrations/<version>_....sql`** files with those names so **local files match remote history**, then re-run `migration list` until aligned. Lowest magic, highest traceability. |
| **B. Controlled `supabase db pull` on a branch** | On a **non–main** branch, run `db pull`, inspect the generated migration(s), split or rename as needed, open a PR. Merge only after the diff matches intentional remote state. |
| **C. `migration repair` only after backup + explicit approval** | Take a **backup** (or use a staging clone), document which remote versions are erroneous, run **`repair`** only for those IDs under change control, then verify `migration list` and a **staging `db push`**. |

Often the best path is **A** or **B** first; **C** is for correcting **known bad history**, not routine drift.

---

## 9. Current safe status (summary)

| Item | Status |
|------|--------|
| **Sprint C1** | **Closed** (stitcher, inbox/reply, identify, read-only TOOL 3/4, inbox suggestion UI). |
| **C2A migration source** | **Present in repo** (`20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`). |
| **Production apply** | **Blocked by migration drift** — `db push` cannot run until local/remote migration versions reconcile. |
| **C2B write-path work** | **Do not start** until a **drift policy** is chosen and migration history is consistent; otherwise schema and RLS reviews will not match reality. |

---

## 10. Next action (documentation only)

1. Decide **A / B / C** (or a hybrid) with the team.  
2. Re-run **`npx supabase@latest migration list`** after each reconciliation step until **no** blank cells remain for in-scope versions.  
3. Only then **`db push`** (or CI apply) for **`20260518220000`** and any other pending local migrations.

---

*End of drift report.*
