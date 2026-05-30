# Production schema gap report — Execution OS vs staging

**Production:** `tcxvcatsqqertcnycuop`  
**Staging reference:** `aruyieslaxjhnamlstpx` (expected schema = repo migrations applied per `docs/EXECUTION_OS_STACK_STAGING_READINESS.md`)  
**Probe date:** 2026-05-30  
**Method:** Read-only SQL on production (`information_schema`, `pg_proc`, `supabase_migrations.schema_migrations`); staging direct SQL via MCP denied — staging column inferred from repo + STAGE 14G operational proof.

---

## Executive summary

Production is **missing the entire Execution OS Phase 3A–4G schema** required for governed dispatch → reservation → stock finalization. Only legacy `order_status_history` exists among the audited tables. **Gap count: 9 migrations / 14 supporting tables not deployed.**

---

## 1. Missing tables

| Table | Staging (expected) | Production |
|-------|-------------------|------------|
| `dispatch_readiness_evidence` | Present | **MISSING** |
| `finance_review_evidence` | Present | **MISSING** |
| `dispatch_completion_evidence` | Present | **MISSING** |
| `dispatch_release_lineage` | Present | **MISSING** |
| `inventory_reservations` | Present | **MISSING** |
| `stock_consumption_lineage` | Present | **MISSING** |
| `inventory_movements` | Present | **MISSING** |
| `inventory_stock_balances` | Present | **MISSING** |
| `operational_scan_records` | Present | **MISSING** |
| `order_status_history` | Present | **Present** (legacy) |

### Supporting tables (also missing on production — required for FKs / staging parity)

| Table | Production |
|-------|------------|
| `operational_queue_items` | **MISSING** |
| `operational_queue_assignments` | **MISSING** |
| `operational_events` | **MISSING** |
| `inventory_reservation_allocations` | **MISSING** |
| `operational_search_index` | **MISSING** |

---

## 2. Missing indexes (expected from repo — all absent with tables)

### `operational_scan_records` (7 + 1 unique partial)

- `idx_operational_scan_records_barcode_value`
- `idx_operational_scan_records_order_id`
- `idx_operational_scan_records_queue_item_id`
- `idx_operational_scan_records_verification_status`
- `idx_operational_scan_records_created_at`
- `idx_operational_scan_records_correlation_id`
- `idx_operational_scan_records_duplicate_window`
- `idx_operational_scan_records_idempotency_key` (UNIQUE partial)

### `inventory_reservations` (5)

- `idx_inventory_reservations_order_id`
- `idx_inventory_reservations_product_sku`
- `idx_inventory_reservations_status`
- `idx_inventory_reservations_expires_at`
- `idx_inventory_reservations_queue_item`

### `inventory_movements` (3)

- `idx_inventory_movements_reservation_id`
- `idx_inventory_movements_product_sku`
- `idx_inventory_movements_correlation_id`

### Evidence tables (4B–4E: 2 each)

- `idx_dispatch_readiness_evidence_order_id`, `_correlation`
- `idx_finance_review_evidence_order_id`
- `idx_dispatch_completion_evidence_order_id`, `_correlation`
- `idx_dispatch_release_lineage_order_id`, `_correlation`

### `inventory_stock_balances` (2)

- `idx_inventory_stock_balances_product_sku`
- `idx_inventory_stock_balances_location`

### `stock_consumption_lineage` (2)

- `idx_stock_consumption_lineage_order`
- `idx_stock_consumption_lineage_reservation`

### Foundation / search (if full parity)

- 6+ indexes on `operational_queue_items`, 1 on assignments, 4 on events, 12+ on `operational_search_index` (incl. GIN)

---

## 3. Missing constraints

| Constraint | Table | Production |
|------------|-------|------------|
| `lineage_type` IN (`consumption_finalized`, …) | `stock_consumption_lineage` | **MISSING** (no table) |
| `movement_type` IN (…, `dispatch_consumption_confirmed`, …) | `inventory_movements` | **MISSING** (no table) |
| `reservation_status` + qty coherence | `inventory_reservations` | **MISSING** |
| `release_type` + status fields | `dispatch_release_lineage` | **MISSING** |
| `review_type`, `review_status` | `finance_review_evidence` | **MISSING** |
| `evidence_type`, `completion_status` | `dispatch_completion_evidence` | **MISSING** |
| `evidence_type`, `evidence_status` | `dispatch_readiness_evidence` | **MISSING** |
| Scan type / verification CHECKs | `operational_scan_records` | **MISSING** |
| `inventory_stock_balances_unique` (product_id, sku, location_code) | `inventory_stock_balances` | **MISSING** |

---

## 4. Missing RLS policies

All Execution OS tables expect **RLS enabled** with `is_internal_staff` (and role gates on 4B–4E inserts). Production has **zero policies** on missing tables.

### Expected policy counts (from migrations)

| Table | SELECT | INSERT | UPDATE | Other |
|-------|--------|--------|--------|-------|
| `operational_scan_records` | 1 | 1 | — | REVOKE UPDATE/DELETE |
| `inventory_reservations` | 1 | 1 | 1 | — |
| `inventory_reservation_allocations` | 1 | 1 | 1 | — |
| `inventory_movements` | 1 | 1 | — | REVOKE UPDATE/DELETE |
| `dispatch_readiness_evidence` | 1 | 1 | — | append-only triggers |
| `finance_review_evidence` | 1 | 1 (finance roles) | — | append-only |
| `dispatch_completion_evidence` | 1 | 1 (dispatch roles) | — | append-only |
| `dispatch_release_lineage` | 1 | 1 (dispatch roles) | — | REVOKE UPDATE/DELETE |
| `inventory_stock_balances` | 1 | 1 | 1 | governed update |
| `stock_consumption_lineage` | 1 | 1 | — | REVOKE UPDATE/DELETE |

**Production prerequisite helpers:** `is_internal_staff`, `get_user_role` — **present**.

---

## 5. Missing triggers / functions

| Function | Production |
|----------|------------|
| `prevent_operational_scan_mutation` | **MISSING** |
| `prevent_inventory_movement_mutation` | **MISSING** |
| `prevent_stock_consumption_lineage_mutation` | **MISSING** |
| `dispatch_readiness_evidence_immutable` | **MISSING** |
| `finance_review_evidence_immutable` | **MISSING** |
| `dispatch_completion_evidence_immutable` | **MISSING** |
| `dispatch_release_lineage_immutable` | **MISSING** |
| `prevent_operational_event_mutation` | **MISSING** (if foundation not applied) |

Associated **BEFORE UPDATE/DELETE triggers** on each append-only table: **all missing**.

---

## 6. Migration history gap

**Production** `supabase_migrations.schema_migrations` (remote via MCP):

- Latest entries include WhatsApp / finance audit (`20260518210953`, etc.)
- **No** versions `20260525230000` through `20260526160000`

**Repo local migrations (not on production):**

| Version | Name |
|---------|------|
| `20260525230000` | `execution_os_phase3a3d_foundation` |
| `20260526010000` | `execution_os_phase3c_barcode_execution` |
| `20260526020000` | `execution_os_phase3i_operational_search_index` |
| `20260526030000` | `execution_os_phase4a_inventory_reservation` |
| `20260526120000` | `execution_os_phase4b_dispatch_readiness` |
| `20260526130000` | `execution_os_phase4c_finance_governance` |
| `20260526140000` | `execution_os_phase4d_dispatch_completion` |
| `20260526150000` | `execution_os_phase4e_dispatch_finalization` |
| `20260526160000` | `execution_os_phase4g_stock_finalization` |

See also `docs/SUPABASE_MIGRATION_DRIFT_REPORT.md` for broader local/remote version mismatches that may block `supabase db push`.

---

## 7. Staging vs production comparison matrix

| Layer | Staging | Production |
|-------|---------|------------|
| Pilot 10 tables | 9/10 exist (all except N/A) | **1/10** (`order_status_history` only) |
| FK foundation (`operational_queue_items`) | Present | **Missing** |
| Append-only triggers | Present | **Missing** |
| 4G movement types | Present | **Missing** |
| Governed RLS | Present | **Missing** |
| Migration versions applied | Yes | **No** |
| Golden chain UI (14G) | Proven | **Blocked** (persistence unavailable) |

---

## 8. Legacy objects on production (not substitutes)

Production has related but **non-equivalent** objects:

- `ols_inventory_movements`, `ols_stock_units`, `factory_inventory`, `inventory_items` — legacy OLS paths, not governed 4A/4G ledger
- `order_status_history` — status audit, **not** `dispatch_release_lineage`

Do not use these for pilot verification.

---

## 9. Remediation

Apply migrations per `docs/MIGRATION_DEPLOYMENT_PLAN.md`, then re-run `docs/PHASE_15_1_PRODUCTION_READ_ONLY_PROBE_REPORT.md` criteria.
