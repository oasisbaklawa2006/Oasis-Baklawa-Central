# PHASE 15.2 REPORT — Execution OS production migration deployment plan

**Date:** 2026-05-30  
**Production:** `tcxvcatsqqertcnycuop`  
**Staging:** `aruyieslaxjhnamlstpx`  
**Rules honored:** Read-only audit; no migrations run; no production writes.

---

## 1. Migration inventory

### Direct table creators (user-requested)

| Table | Migration file |
|-------|----------------|
| `operational_scan_records` | `20260526010000_execution_os_phase3c_barcode_execution.sql` |
| `inventory_reservations` | `20260526030000_execution_os_phase4a_inventory_reservation.sql` |
| `inventory_movements` | `20260526030000_execution_os_phase4a_inventory_reservation.sql` (+ CHECK extended in `20260526160000_execution_os_phase4g_stock_finalization.sql`) |
| `dispatch_readiness_evidence` | `20260526120000_execution_os_phase4b_dispatch_readiness.sql` |
| `finance_review_evidence` | `20260526130000_execution_os_phase4c_finance_governance.sql` |
| `dispatch_completion_evidence` | `20260526140000_execution_os_phase4d_dispatch_completion.sql` |
| `dispatch_release_lineage` | `20260526150000_execution_os_phase4e_dispatch_finalization.sql` |
| `inventory_stock_balances` | `20260526160000_execution_os_phase4g_stock_finalization.sql` |
| `stock_consumption_lineage` | `20260526160000_execution_os_phase4g_stock_finalization.sql` |

`order_status_history` — **not** created by Execution OS; already on production (legacy).

### Required dependency migrations (not optional)

| Migration | Why |
|-----------|-----|
| `20260525230000_execution_os_phase3a3d_foundation.sql` | FK target for `operational_queue_items` (4A, 3C) |
| `20260526020000_execution_os_phase3i_operational_search_index.sql` | Staging parity (optional for pilot ten-table list; recommended) |

**Total migrations to match staging golden-chain DB:** **9 files** (see `MIGRATION_DEPLOYMENT_PLAN.md`).

---

## 2. Execution order

```
1. 20260525230000  phase3a3d_foundation
2. 20260526010000  phase3c_barcode_execution
3. 20260526020000  phase3i_operational_search_index  (staging parity)
4. 20260526030000  phase4a_inventory_reservation
5. 20260526120000  phase4b_dispatch_readiness
6. 20260526130000  phase4c_finance_governance
7. 20260526140000  phase4d_dispatch_completion
8. 20260526150000  phase4e_dispatch_finalization
9. 20260526160000  phase4g_stock_finalization
```

---

## 3. Schema gap summary

| Category | Staging (expected) | Production (probed) |
|----------|-------------------|---------------------|
| Core pilot tables | 9 created + `order_status_history` | **1** (`order_status_history` only) |
| Supporting tables | 5+ | **0** |
| Indexes | ~40+ across stack | **0** |
| CHECK constraints (4G/4A/4E/4C/4D) | Present | **0** |
| RLS policies | ~25+ | **0** on new tables |
| Immutable triggers | 8 tables | **0** |
| Helper functions | 8+ | **2** only (`is_internal_staff`, `get_user_role`) |
| Migration rows `20260525*`–`20260526*` | Applied | **Not applied** |

Full detail: `PRODUCTION_SCHEMA_GAP_REPORT.md`.

---

## 4. Deployment risks

| Risk | Level |
|------|-------|
| **Schema entirely absent** — pilot impossible without DDL | Critical |
| **Migration history drift** may block CLI push | High |
| DDL lock / downtime during apply | Medium |
| App (PR #132) already on Vercel pointing at production Supabase | Medium — users see “persistence unavailable” |
| Rollback after data written | High complexity |

---

## 5. Estimated deployment time

| Activity | Technical duration |
|----------|------------------|
| Drift reconciliation (pre-requisite) | Variable |
| Apply 9 DDL migrations (empty tables) | **~3–15 minutes** |
| Read-only re-probe + smoke | **~15–30 minutes** |

---

## 6. Deliverables

| Document | Path |
|----------|------|
| Migration deployment plan | `docs/MIGRATION_DEPLOYMENT_PLAN.md` |
| Production schema gap report | `docs/PRODUCTION_SCHEMA_GAP_REPORT.md` |
| This summary | `docs/PHASE_15_2_REPORT.md` |

---

## 7. Verdict

| | |
|--|--|
| **READY FOR CONTROLLED PRODUCTION MIGRATION** | **YES (planning)** — inventory complete, order defined, risks documented |
| **READY TO EXECUTE MIGRATIONS NOW** | **NO** — requires drift reconciliation, maintenance window, explicit approval, and post-apply Phase 15.1 re-probe |
| **READY FOR PILOT ORDER SETUP** | **NO** — blocked until migrations applied |

---

## 8. Recommended next steps (execution phase — out of scope for 15.2)

1. Reconcile `supabase_migrations` drift per `SUPABASE_MIGRATION_DRIFT_REPORT.md`.
2. Apply nine migrations on production in order (`MIGRATION_DEPLOYMENT_PLAN.md`).
3. Re-run Phase 15.1 read-only probe (all tables + constraints).
4. Enable `PRODUCTION_PILOT_CHECKLIST.md` for 5–10 orders.
