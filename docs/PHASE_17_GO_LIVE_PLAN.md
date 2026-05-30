# PHASE 17 — Execution OS go-live plan

**Objective:** Move Oasis Central from **staging-complete** to **production-operational** as fast as possible.  
**Rules:** No feature development. No production writes from this document.  
**Production:** `tcxvcatsqqertcnycuop`  
**Code:** `main` @ `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**App:** Already deployed with Execution OS UI; **database schema is not applied.**

---

## 1. Go-live definition

| Milestone | Meaning |
|-----------|---------|
| **G0** | Production DDL applied + reprobe PASS |
| **G1** | 5-order pilot PASS on production (`PILOT_ORDER_TEST_MATRIX.md`) |
| **G2** | Legacy write lockdown **in effect** for pilot cohort (policy + access; see `PHASE_17_LEGACY_WRITE_LOCKDOWN.md`) |
| **G3** | Operator training complete; company rollout checklist signed |

**Operational** = pilot operators can run golden chain 4B→4G on real production orders without schema errors and without ungoverned `dispatched` / consumption bypass.

---

## 2. Preconditions (gate before any DDL)

| # | Item | Owner | Sign-off |
|---|------|-------|----------|
| 1 | Change ticket approved (maintenance window) | Ops | ☐ |
| 2 | PITR / backup of production DB | DBA | ☐ |
| 3 | `npx supabase migration list --linked` → **19 local-only**, **0 remote-only** | Eng | ☐ |
| 4 | Engineering lead reviewed `20260508155100` RLS impact | Eng | ☐ |
| 5 | Pilot operators in `is_internal_staff` + role map (4B–4E insert roles) | Ops | ☐ |
| 6 | `VITE_EXECUTION_PREVIEW_FALLBACK=false`, `VITE_STOCK_FINALIZATION_DEMO=false` on Vercel production | Eng | ☐ |
| 7 | Pilot order roster blank in `PILOT_ORDER_TEST_MATRIX.md` (fill before G1) | Ops | ☐ |
| 8 | Rollback owner named | DBA + Eng | ☐ |

---

## 3. Exact migration execution sequence

**Method:** `npx supabase db push` (applies all pending in timestamp order — **do not reorder**).

| Step | Version | Name (short) | Risk note |
|------|---------|--------------|-----------|
| 1 | `20260503201343` | B2B request info columns | Low |
| 2 | `20260503215926` | `users.deleted_at` | Low |
| 3 | `20260504035656` | `debug_webhooks.message_intent` | Low |
| 4 | `20260508155100` | Sales roster RLS | **High** — policy rewrite |
| 5 | `20260510120000` | `dispatches` proof columns | Low |
| 6 | `20260515120000` | Orders finance audit cols | Low (IF NOT EXISTS) |
| 7 | `20260515120001` | Payment enum label | Low |
| 8 | `20260515194500` | Buyer receipt + storage RLS | Medium |
| 9 | `20260516200000` | `payment_rejection_reason` | Low |
| 10 | `20260518220000` | WhatsApp audit reconcile | Low (idempotent) |
| 11 | `20260525230000` | **Execution OS** 3A3D foundation | Medium |
| 12 | `20260526010000` | **Execution OS** 3C scans | Medium |
| 13 | `20260526020000` | **Execution OS** 3I search index | Medium |
| 14 | `20260526030000` | **Execution OS** 4A reservations | Medium |
| 15 | `20260526120000` | **Execution OS** 4B readiness | Medium |
| 16 | `20260526130000` | **Execution OS** 4C finance evidence | Medium |
| 17 | `20260526140000` | **Execution OS** 4D completion | Medium |
| 18 | `20260526150000` | **Execution OS** 4E finalization | Medium |
| 19 | `20260526160000` | **Execution OS** 4G stock finalization | Medium |

**Execution OS subset:** steps **11–19** only (requires steps 1–10 recorded unless DBA custom apply).

---

## 4. Operator command sequence (execution day)

```bash
# T-24h: confirm SHA
git fetch origin && git checkout 189177dfd70407ac02b042cd11a7a5f24f846e44

# T0: link
npx supabase@latest login
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop

# T0: archive pre-state
npx supabase@latest migration list --linked | tee migration-list-pre.txt

# T0: pre-deploy counts (SQL editor — PHASE_15_5 §8)
# SELECT 'orders', count(*) FROM orders UNION ALL SELECT 'order_status_history', count(*) FROM order_status_history;

# T0+backup: DBA snapshot complete → proceed

# T1: apply
npx supabase@latest db push

# T1+5m: confirm history
npx supabase@latest migration list --linked | tee migration-list-post.txt

# T1+15m: reprobe (read-only)
# Run all gates G1–G8 in docs/PHASE_15_5_PRODUCTION_REPROBE.md

# T1+30m: UI smoke (no pilot writes yet)
# Login SUPER_ADMIN → open each board 4B, 4C, 4D, 4E, 4F, 4G — no "persistence unavailable"

# T2: pilot (separate section below)
```

**On `db push` failure:** STOP. Capture error + last `schema_migrations.version`. No blind `migration repair`.

---

## 5. Expected duration

| Phase | Duration |
|-------|----------|
| Preconditions + backup | 30–90 min (calendar) |
| `db push` (19 migrations) | **15–45 min** |
| Reprobe G1–G8 | **15–30 min** |
| UI smoke (6 boards) | **15–20 min** |
| **DDL window subtotal** | **~45–105 min** |
| 5-order pilot (UI golden chain) | **4–8 hours** (operator time, serial) |
| Training + lockdown briefing | **1–2 hours** |
| **Minimum calendar to G1** | **1 working day** after approved window |
| **Minimum to G3 (limited rollout)** | **2–3 working days** with ops availability |

---

## 6. Rollback plan

### 6.1 Default: forward-only

- Keep schema; stop pilot via checklist halt criteria.
- Do not drop tables if any pilot lineage exists.

### 6.2 DDL rollback (only if zero writes to new tables)

Drop order (DBA script, supervised):

`4G → 4E → 4D → 4C → 4B → 4A → 3I → 3C → 3A3D`

Remove matching `schema_migrations` rows only with DBA sign-off.

### 6.3 Application rollback

- Vercel rollback to prior deployment **does not remove schema** — only use if UI regression; DB stays forward.

### 6.4 Never without approval

- `migration repair` without written plan  
- `db pull` on production  
- Dropping `orders` or legacy inventory tables  

---

## 7. Validation sequence (post-DDL)

Execute in order after `db push`:

| Seq | Activity | Document | Pass |
|-----|----------|----------|------|
| V1 | Migration list: 19 new remote rows | CLI output | ☐ |
| V2 | G1–G8 SQL reprobe | `PHASE_15_5_PRODUCTION_REPROBE.md` | ☐ |
| V3 | Phase 15.1 table probe (spot-check) | `PHASE_15_1_PRODUCTION_READ_ONLY_PROBE_REPORT.md` | ☐ |
| V4 | Boards load (4B–4G) | Manual smoke | ☐ |
| V5 | `is_internal_staff` + pilot user role test insert (optional dry-run on non-pilot) | SQL / UI | ☐ |
| V6 | Pre-pilot checklist A1–A8 | `PRODUCTION_PILOT_CHECKLIST.md` §A | ☐ |

**Pilot may start only after V1–V6 pass.**

---

## 8. Pilot sequence (5 orders)

**Per order** — UI only, no manual SQL writes to governance tables.

| Order | Step | Route | Action |
|-------|------|-------|--------|
| 1 | 4B | `/admin/dispatch-readiness` | Evidence + readiness review |
| 2 | 4C | `/admin/finance-governance` | Start review → commercial release |
| 3 | 4D | `/admin/dispatch-completion` | Attest completion |
| 4 | 4E | `/admin/dispatch-finalization` | **Only** path to `orders.status = dispatched` |
| 5 | 4F | `/admin/reservation-board` | Create & reserve (context must match) |
| 6 | 4G | `/admin/stock-finalization` | Override reason if SUPER_ADMIN → finalize |

**After each order:** read-only SQL from `PRODUCTION_PILOT_CHECKLIST.md` §C.

**Stop pilot if:**

- Duplicate `consumption_finalized` lineage  
- `orders.status` changes outside 4E  
- Persistence errors on any board  

**Record:** `PILOT_ORDER_TEST_MATRIX.md` (5 rows minimum).

---

## 9. Post-pilot (same week, if G1 pass)

| Step | Action |
|------|--------|
| P1 | Post-pilot review E1–E5 (`PRODUCTION_PILOT_CHECKLIST.md`) |
| P2 | Enforce legacy lockdown policy (`PHASE_17_LEGACY_WRITE_LOCKDOWN.md`) |
| P3 | Company rollout checklist (`PHASE_17_COMPANY_ROLLOUT_CHECKLIST.md`) |
| P4 | Expand from 5 → 10 orders only after E1 pass |

---

## 10. References

| Doc | Use |
|-----|-----|
| `PRODUCTION_DEPLOYMENT_RUNBOOK.md` | Command detail |
| `PHASE_15_5_PRODUCTION_REPROBE.md` | SQL gates |
| `PRODUCTION_PILOT_CHECKLIST.md` | Pilot rules |
| `PILOT_ORDER_TEST_MATRIX.md` | Per-order tracking |
| `PHASE_15_3_MIGRATION_DRIFT_REPORT.md` | Why 19 migrations |
| `PHASE_17_LEGACY_WRITE_LOCKDOWN.md` | Route policy |
| `PHASE_17_COMPANY_ROLLOUT_CHECKLIST.md` | Rollout sign-off |

---

*End of Phase 17 go-live plan.*
