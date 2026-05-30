# PHASE 15.1 — Production read-only pre-pilot probe report

**Date:** 2026-05-30  
**Production Supabase project:** `tcxvcatsqqertcnycuop` (`oasis-baklawa`, ap-south-1, **ACTIVE_HEALTHY**)  
**Probe method:** Read-only SQL via Supabase MCP `execute_sql` (SELECT / `information_schema` only). No INSERT, UPDATE, DELETE, or migrations executed.

---

## Production project confirmation

| Check | Result |
|-------|--------|
| Project ref | `tcxvcatsqqertcnycuop` |
| API URL | `https://tcxvcatsqqertcnycuop.supabase.co` |
| Database | PostgreSQL 17.6 |
| MCP read access | **OK** (queries succeeded) |

---

## Table existence

| Required table | Exists on production |
|----------------|---------------------|
| `dispatch_readiness_evidence` | **NO** |
| `finance_review_evidence` | **NO** |
| `dispatch_completion_evidence` | **NO** |
| `dispatch_release_lineage` | **NO** |
| `inventory_reservations` | **NO** |
| `stock_consumption_lineage` | **NO** |
| `inventory_movements` | **NO** |
| `inventory_stock_balances` | **NO** |
| `operational_scan_records` | **NO** |
| `order_status_history` | **YES** |

**Related legacy tables present (not pilot substitutes):** `dispatches`, `dispatch_cartons`, `factory_inventory`, `inventory_items`, `inventory_adjustments`, `ols_inventory_movements`, `ols_stock_units`, `stock_logs`.

**Dependency tables also missing:** `operational_queue_items` (referenced by Phase 4A reservations).

---

## Column / constraint confirmation

Governance Phase 4A–4G constraints **cannot be validated on production** — base tables are absent.

### `order_status_history` (exists — legacy shape)

| Column | Present |
|--------|---------|
| `id`, `order_id`, `changed_by` | YES |
| `old_status`, `new_status` | YES (not `previous_status` / `next_status` on `dispatch_release_lineage`) |
| `changed_at` | YES |

### Expected from repo migrations (not on production)

| Requirement | Repo source | Production |
|-------------|-------------|------------|
| `stock_consumption_lineage.lineage_type` includes `consumption_finalized` | `20260526160000_execution_os_phase4g_*.sql` | **N/A — table missing** |
| `inventory_movements.movement_type` includes `dispatch_consumption_confirmed` | Phase 4A + 4G migrations | **N/A — table missing** |
| `inventory_reservations.reservation_status`, `reserved_qty`, `fulfilled_qty` | Phase 4A | **N/A — table missing** |
| `dispatch_release_lineage.release_type`, `previous_status`, `next_status` | Phase 4E | **N/A — table missing** |
| `finance_review_evidence.review_type`, `review_status` | Phase 4C | **N/A — table missing** |
| `dispatch_completion_evidence.evidence_type`, `completion_status` | Phase 4D | **N/A — table missing** |

---

## Migration history (read-only)

`supabase_migrations.schema_migrations` on production has **no** rows matching `execution_os` or `phase4`:

- Latest applied names include WhatsApp, finance audit, `orders_human_order_number`, etc.
- **None** of:
  - `20260526030000_execution_os_phase4a_inventory_reservation`
  - `20260526120000_execution_os_phase4b_dispatch_readiness`
  - `20260526130000_execution_os_phase4c_finance_governance`
  - `20260526140000_execution_os_phase4d_dispatch_completion`
  - `20260526150000_execution_os_phase4e_dispatch_finalization`
  - `20260526160000_execution_os_phase4g_stock_finalization`
  - (Phase 3 barcode / operational scan migrations also not listed)

---

## Row counts

| Table | Row count |
|-------|-----------|
| `dispatch_readiness_evidence` | — (missing) |
| `finance_review_evidence` | — (missing) |
| `dispatch_completion_evidence` | — (missing) |
| `dispatch_release_lineage` | — (missing) |
| `inventory_reservations` | — (missing) |
| `stock_consumption_lineage` | — (missing) |
| `inventory_movements` | — (missing) |
| `inventory_stock_balances` | — (missing) |
| `operational_scan_records` | — (missing) |
| `order_status_history` | **30** |

---

## Deployed SHA / environment confirmation

### Git / Vercel production deployment

| Check | Result |
|-------|--------|
| PR #132 merge commit on `main` | `189177dfd70407ac02b042cd11a7a5f24f846e44` |
| Current production deployment (`target: production`) | **MATCH** — `githubCommitSha: 189177dfd70407ac02b042cd11a7a5f24f846e44` |
| Deployment URL (sample) | `cursor-central-vercel-g68lh69hv-oasisbaklawa2006-6222s-projects.vercel.app` |
| Project | `cursor-central-vercel` (Vercel) |

### Production bundle / env (read-only fetch)

| Check | Result |
|-------|--------|
| HTML preconnect | `https://tcxvcatsqqertcnycuop.supabase.co` |
| JS bundle contains `tcxvcatsqqertcnycuop` | **YES** (1 occurrence) |
| JS bundle contains `aruyieslaxjhnamlstpx` (staging) | **NO** (0 occurrences) |
| `VITE_EXECUTION_PREVIEW_FALLBACK=true` literal in main bundle | **Not found** (consistent with disabled / build-time false) |
| `VITE_STOCK_FINALIZATION_DEMO=true` literal in main bundle | **Not found** |
| App includes `supabaseStockFinalizationStore` chunk | **YES** (code present; DB tables absent → UI will show persistence unavailable) |

**Note:** Vercel env var values (`VITE_*`) are not exposed via this probe; bundle behavior suggests production Supabase URL is wired correctly and demo/preview flags are not enabled in the shipped artifact.

---

## RLS / policies (limited probe)

| Table | Policy count (read-only) |
|-------|--------------------------|
| `order_status_history` | 2 |

Policies on missing governance tables could not be assessed.

---

## Blockers

1. **CRITICAL — Phase 4A–4G schema not applied on production**  
   Nine of ten required tables are missing. Governed pilot (4B→4F→4G) **cannot persist** evidence, reservations, lineage, or movements on `tcxvcatsqqertcnycuop` today.

2. **CRITICAL — Migrations required before any production pilot order**  
   Apply controlled migration plan for Execution OS Phase 3 (scan) + Phase 4A–4G on production (separate change window; out of scope for this read-only probe).

3. **HIGH — UI/code ahead of production database**  
   Production app at PR #132 will load governance boards but `probeStockFinalizationTables` / reservation probes will fail → boards show **unavailable** or block writes.

4. **MEDIUM — `order_status_history` ≠ `dispatch_release_lineage`**  
   Existing 30 rows are on legacy status history; not a substitute for 4E finalize lineage.

5. **LOW — Staging isolation in production bundle**  
   **PASS** — no staging project ref in production JS.

---

## Verdict

| | |
|--|--|
| **READY FOR PILOT ORDER SETUP** | **NOT READY** |

**Reason:** Production database lacks the governed execution schema required for the golden chain. Code and Vercel production deployment include PR #132 and point at the correct Supabase project, but **schema must be applied first** (planned migration window, not part of this probe).

**Recommended next step (engineering, not this task):** Execute approved production migration rollout for Phase 4A–4G (and Phase 3 scan prerequisites), then re-run this read-only probe until all ten tables exist with expected CHECK constraints.

---

## PR #132 merge (task item 1)

| Item | Status |
|------|--------|
| Merge PR #132 | **Already merged** (before this probe) |

No additional merge action required.
