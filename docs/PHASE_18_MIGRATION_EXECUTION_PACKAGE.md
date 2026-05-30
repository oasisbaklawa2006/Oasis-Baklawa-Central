# PHASE 18 — Migration execution package (production)

**Project:** `tcxvcatsqqertcnycuop` (Oasis Baklawa Central production)  
**Code SHA:** `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Operator:** DBA + designated migration engineer (pair)  
**References:** `PRODUCTION_DEPLOYMENT_RUNBOOK.md`, `PHASE_15_5_PRODUCTION_REPROBE.md`, `PHASE_17_GO_LIVE_PLAN.md`

This package is **executable runbook material**. Run only during an approved change window.

---

## 1. Pre-flight checklist (DBA + engineering)

| # | Check | Owner | ☐ |
|---|------|-------|---|
| 1 | Change ticket # ______ approved | Ops | |
| 2 | Maintenance window start/end (UTC): ______ → ______ | Ops | |
| 3 | Rollback owner: DBA ______ Eng ______ | | |
| 4 | Communication channel live (Slack/Teams war room) | Ops | |
| 5 | Workstation has Supabase CLI ≥ linked project | Eng | |
| 6 | Repo at `189177dfd70407ac02b042cd11a7a5f24f846e44` | Eng | |
| 7 | `migration list --linked` shows **19 local-only**, **0 remote-only** | Eng | |
| 8 | Engineering signed `20260508155100` RLS review | Eng lead | |
| 9 | No other DDL jobs on production | DBA | |
| 10 | PITR / backup completed — backup ID: ______ | DBA | |

---

## 2. Exact commands (copy-paste sequence)

### 2.1 Environment setup

```bash
export PROD_REF=tcxvcatsqqertcnycuop
export CUTOVER_SHA=189177dfd70407ac02b042cd11a7a5f24f846e44
export ARTIFACT_DIR=./cutover-artifacts-$(date +%Y%m%d-%H%M%S)
mkdir -p "$ARTIFACT_DIR"
cd /path/to/Oasis-Baklawa-Central

git fetch origin
git checkout "$CUTOVER_SHA"
git rev-parse HEAD | tee "$ARTIFACT_DIR/git-head.txt"
```

### 2.2 Supabase link

```bash
npx supabase@latest login
npx supabase@latest link --project-ref "$PROD_REF"
npx supabase@latest projects list | tee "$ARTIFACT_DIR/projects-list.txt"
```

### 2.3 Pre-migration archive

```bash
npx supabase@latest migration list --linked | tee "$ARTIFACT_DIR/migration-list-PRE.txt"
```

**Expected (pattern):** ~101 rows on Remote; ~19 rows with Local filled, Remote empty (versions `20260503201343` through `20260526160000`).

**Stop if:** Any Remote version has **no** matching file under `supabase/migrations/`.

### 2.4 Pre-deploy SQL (Supabase SQL Editor — read-only)

Save results to `$ARTIFACT_DIR/pre-counts.txt`:

```sql
SELECT 'orders' AS tbl, count(*)::text AS cnt FROM public.orders
UNION ALL
SELECT 'order_status_history', count(*)::text FROM public.order_status_history;

SELECT version FROM supabase_migrations.schema_migrations
WHERE version >= '20260525230000'
ORDER BY version;
-- Expect 0 rows pre-migrate
```

**Screenshot required:** SQL editor result for counts + empty Execution OS migration query.

### 2.5 Apply migrations (T0 core)

```bash
npx supabase@latest db push 2>&1 | tee "$ARTIFACT_DIR/db-push.log"
echo "EXIT_CODE=$?" | tee "$ARTIFACT_DIR/db-push-exit.txt"
```

**Expected stdout (pattern):**

- Lines like `Applying migration 20260503201343...` through `20260526160000...`
- Ends with success / no error stack trace
- `EXIT_CODE=0`

### 2.6 Post-migration archive

```bash
npx supabase@latest migration list --linked | tee "$ARTIFACT_DIR/migration-list-POST.txt"
```

**Expected:** All 19 versions show **both** Local and Remote columns populated.

```sql
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '20260503201343'
ORDER BY version;
-- Expect 19 rows
```

**Screenshot required:** `migration-list-POST.txt` tail showing Execution OS versions; SQL showing 19 rows.

---

## 3. Reprobe immediately after push (T+15m)

Run **all** queries in `PHASE_15_5_PRODUCTION_REPROBE.md` gates G1–G8. Save each result:

| Gate | Expect | Artifact file |
|------|--------|---------------|
| G1 | 10 tables, all OK | `reprobe-g1-tables.txt` |
| G2 | 5 supporting tables | `reprobe-g2-support.txt` |
| G3 | 9 versions `20260525230000`–`20260526160000` | `reprobe-g3-migrations.txt` |
| G4 | 10 functions | `reprobe-g4-functions.txt` |
| G5 | RLS true on all listed tables | `reprobe-g5-rls.txt` |
| G6 | CHECK defs contain required strings | `reprobe-g6-checks.txt` |
| G7 | `is_internal_staff`, `get_user_role` | `reprobe-g7-helpers.txt` |
| G8 | Counts match pre-deploy snapshot | `reprobe-g8-counts.txt` |

**Screenshot required:** G1 table list; G3 migration rows; G6 CHECK snippet for `dispatch_consumption_confirmed`.

---

## 4. UI smoke (T+30m) — no pilot writes

| # | URL | Login role | Pass criterion |
|---|-----|------------|----------------|
| 1 | `/admin/dispatch-readiness` | Dispatch lead | Board loads; no “persistence unavailable” |
| 2 | `/admin/finance-governance` | Finance lead | Board loads |
| 3 | `/admin/dispatch-completion` | Dispatch lead | Board loads |
| 4 | `/admin/dispatch-finalization` | Dispatch lead | Board loads |
| 5 | `/admin/reservation-board` | Inventory lead | Board loads |
| 6 | `/admin/stock-finalization` | Inventory lead | Board loads |

**Screenshot required:** One board showing live (not preview) banner; one showing table list without schema error toast.

---

## 5. Expected outputs summary

| Step | Success signal |
|------|----------------|
| `db push` | Exit 0; 19 migrations applied |
| `migration list --linked` POST | No blank Remote for pending 19 |
| G1 | `dispatch_readiness_evidence`, `finance_review_evidence`, … all exist |
| G3 | 9 Execution OS migration versions |
| G6 | `dispatch_consumption_confirmed`, `consumption_finalized` in CHECK text |
| G8 | `orders` / `order_status_history` counts unchanged |
| UI smoke | 6 boards load |

---

## 6. Stop conditions (halt immediately)

| # | Condition | Action |
|---|-----------|--------|
| S1 | `db push` non-zero exit | **STOP** — do not repair blindly |
| S2 | Partial apply (some tables exist, migration history incomplete) | **STOP** — DBA assess; no second push |
| S3 | G1 any pilot table MISSING | **STOP** — do not start pilot |
| S4 | G8 row count drop on `orders` or `order_status_history` | **STOP** — incident |
| S5 | RLS disabled on governance table | **STOP** |
| S6 | Auth outage / mass login failure after step 4 migration | **STOP** — assess RLS migration |
| S7 | Duplicate `consumption_finalized` during smoke (should not happen) | **STOP** |

**On STOP:** Notify rollback owner; preserve `$ARTIFACT_DIR`; no pilot orders.

---

## 7. Failure scenarios and response

| Failure | Likely cause | Response |
|---------|--------------|----------|
| `Remote migration versions not found in local` | Repo drift | Fix repo alignment; do not push until list clean |
| `relation already exists` mid-push | Partial prior apply | DBA: compare `schema_migrations` vs `information_schema.tables`; **STOP** |
| `permission denied` on RLS step | Role / owner | DBA: check migration role; **STOP** |
| `db push` hangs >30 min | Lock contention | DBA: `pg_stat_activity`; consider cancel + reschedule off-peak |
| G6 CHECK missing | 4G before 4A | **STOP** — order violation; DBA review |
| Board “persistence unavailable” | Tables missing or RLS | Re-run G1; verify project ref |
| Login works but INSERT denied on 4B | `is_internal_staff` false | Fix staff map before pilot |

---

## 8. Rollback decision tree

```
db push failed?
├─ YES → STOP. Was any migration recorded in schema_migrations?
│   ├─ NO → Fix cause; retry push in same window if safe
│   └─ YES → DBA only: assess partial state. Forward-fix vs restore from backup.
│
db push succeeded, reprobe failed?
├─ G8 count drop? → RESTORE FROM BACKUP (PITR) — decision by DBA owner
├─ G1 missing tables? → Do not pilot. DBA: forward DDL vs restore
├─ G5/G6 only? → STOP pilot. Eng + DBA fix forward; no drop without backup
│
db push + reprobe OK, pilot failure?
├─ Duplicate lineage / wrong status → HALT PILOT (forward-only schema)
└─ Operator error → Single order retry after review; do not rollback DDL
```

**Default after pilot data exists:** **forward-only** (no DROP TABLE).

**DDL rollback allowed only if:** zero rows in all new governance tables + DBA + Eng written approval.

---

## 9. DBA checklist (sign-off)

| # | Task | ☐ | Initials | Time (UTC) |
|---|------|---|----------|------------|
| D1 | Backup / PITR verified | | | |
| D2 | Pre-counts recorded | | | |
| D3 | `db push` witnessed | | | |
| D4 | Post migration list archived | | | |
| D5 | G1–G8 reprobe reviewed | | | |
| D6 | No unexpected locks post-DDL | | | |
| D7 | Rollback path documented if needed | | | |
| D8 | Sign-off: **GO** / **NO-GO** for pilot | | | |

---

## 10. Screenshots / artifacts required (change ticket)

| ID | Capture | Filename |
|----|---------|----------|
| A1 | Supabase dashboard project ref | `01-project-ref.png` |
| A2 | `migration-list-PRE.txt` (snippet) | `02-migration-pre.png` |
| A3 | Pre-deploy SQL counts | `03-pre-counts.png` |
| A4 | `db-push.log` final lines | `04-db-push-success.png` |
| A5 | `migration-list-POST.txt` (Execution OS rows) | `05-migration-post.png` |
| A6 | G1 table existence query | `06-reprobe-g1.png` |
| A7 | G3 migration versions | `07-reprobe-g3.png` |
| A8 | One governance board loaded | `08-ui-board.png` |
| A9 | DBA sign-off line | `09-dba-signoff.png` |

Store all files in `$ARTIFACT_DIR` and attach to change ticket.

---

## 11. Migration version log (fill during execution)

| Step | Version | Applied (UTC) | Operator | Notes |
|------|---------|---------------|----------|-------|
| 1 | 20260503201343 | | | |
| 2 | 20260503215926 | | | |
| 3 | 20260504035656 | | | |
| 4 | 20260508155100 | | | RLS |
| 5 | 20260510120000 | | | |
| 6 | 20260515120000 | | | |
| 7 | 20260515120001 | | | |
| 8 | 20260515194500 | | | |
| 9 | 20260516200000 | | | |
| 10 | 20260518220000 | | | |
| 11 | 20260525230000 | | | 3A3D |
| 12 | 20260526010000 | | | 3C |
| 13 | 20260526020000 | | | 3I |
| 14 | 20260526030000 | | | 4A |
| 15 | 20260526120000 | | | 4B |
| 16 | 20260526130000 | | | 4C |
| 17 | 20260526140000 | | | 4D |
| 18 | 20260526150000 | | | 4E |
| 19 | 20260526160000 | | | 4G |

---

*End of migration execution package.*
