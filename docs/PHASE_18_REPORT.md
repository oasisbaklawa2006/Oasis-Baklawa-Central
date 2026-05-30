# PHASE 18 REPORT — Production cutover execution preparation

**Date:** 2026-05-30  
**Mode:** Executable packages only — no features, UX, governance code, or production writes from this phase.

---

## Deliverables

| Task | Document |
|------|----------|
| 1 — Migration execution package | `docs/PHASE_18_MIGRATION_EXECUTION_PACKAGE.md` |
| 2 — Pilot execution package | `docs/PHASE_18_PILOT_EXECUTION_PACKAGE.md` |
| 3 — Route containment plan | `docs/PHASE_18_ROUTE_CONTAINMENT_PLAN.md` |
| 4 — Go-live command center | `docs/PHASE_18_GO_LIVE_COMMAND_CENTER.md` |

---

## 1. Production deployment readiness

| Item | Status |
|------|--------|
| Runbooks consolidated into execution package | **Yes** |
| Commands, expected outputs, stop conditions | **Yes** |
| Rollback decision tree + DBA checklist | **Yes** |
| Screenshot / artifact list | **Yes** |
| Production schema applied | **No** — awaiting T0 |
| Change window + backup | **Pending** ops |

**Verdict:** **READY TO EXECUTE** when war room opens — not yet executed.

---

## 2. Migration execution readiness

| Gate | Ready? |
|------|--------|
| 19-migration sequence documented | Yes |
| Pre/post `migration list` artifacts | Yes |
| Reprobe G1–G8 wired to package | Yes |
| Failure scenarios + STOP rules | Yes |
| DBA sign-off template | Yes |

**Blocker:** Human approval and T0 window only.

---

## 3. Pilot readiness

| Gate | Ready? |
|------|--------|
| Order selection rules | Yes |
| 5-order matrix template | Yes |
| Per-stage operator instructions | Yes |
| SQL verification per stage (4B–4G) | Yes |
| Pass/fail + escalation criteria | Yes |

**Blocker:** Depends on migration + reprobe PASS; five orders must be nominated at T-1h.

---

## 4. Route containment readiness

| Class | Routes documented | Owner assigned (template) |
|-------|-------------------|---------------------------|
| **A** | 5 groups (finance x2, edges x2, factory_inventory) | Yes — fill names in command center |
| **B** | 13 routes | Yes |
| **C** | 6 governance + security gate | Reference only |

**Blocker:** Containment sign-off sheet must be completed **before first 4B** (no code — policy only).

---

## 5. Remaining blockers

| # | Blocker | Owner |
|---|---------|-------|
| 1 | Production `db push` not executed | DBA + Eng |
| 2 | Reprobe G1–G8 not run on production | Eng |
| 3 | Change ticket + backup | Ops / DBA |
| 4 | Five pilot orders not finalized with UUIDs | Pilot coordinator |
| 5 | Class A route containment not briefed | Finance + Ops |
| 6 | Operator roles / `is_internal_staff` not verified on production | Eng |
| 7 | RLS migration `20260508155100` in bundle — lead sign-off | Eng lead |

---

## What exactly must happen before the first production order enters 4B?

The first visit to `/admin/dispatch-readiness` (4B) is allowed **only after** all of the following:

### A. Database and platform (hard gates)

1. **Approved change window** and war room live.  
2. **DBA backup / PITR** completed and ID recorded.  
3. **`npx supabase db push`** exit 0 — all **19** migrations applied, including `20260526120000` (4B table `dispatch_readiness_evidence`).  
4. **Post-push `migration list --linked`** shows Local + Remote for all pending versions.  
5. **Reprobe PASS:** G1 (pilot tables exist), G2 (supporting tables), G3 (Execution OS migration rows), G4–G7 (functions, RLS, CHECKs, helpers), G8 (legacy counts unchanged).  
6. **UI smoke:** `/admin/dispatch-readiness` loads without “persistence unavailable.”  
7. **DBA written GO** for pilot on migration execution package sign-off.

### B. Application configuration

8. Production deploy at **`189177dfd70407ac02b042cd11a7a5f24f846e44`** (or newer documented SHA).  
9. **`VITE_EXECUTION_PREVIEW_FALLBACK=false`** and **`VITE_STOCK_FINALIZATION_DEMO=false`** on production.

### C. People and access

10. **Dispatch operator** logged in as **internal staff** with role that can **INSERT** on `dispatch_readiness_evidence` (not `SALES_EXECUTIVE`-only).  
11. **Pilot order #1** recorded in matrix: `order_id`, SO, SKU, location — **before** any UI write.  
12. **Route containment sign-off:** Class **A** routes briefed (finance-board, finance, webhook/parser policy, pilot SKU factory_inventory freeze); Class **B** supervisors aware.

### D. Process

13. **Pilot coordinator** confirms no other operator is running golden chain on the same order.  
14. **Stop criteria** communicated (duplicate lineage, schema error, status outside 4E).  
15. **First 4B is not** a substitute for 4C–4G planning — but 4B itself does not require prior governance rows; it requires **schema + RLS + operator authority** above.

**Not required before 4B:** order does not need to be `dispatched` yet (that is 4E). Order should be eligible for readiness per ops rules (typically pre-dispatch production states).

**Summary sentence:** Before the first production 4B, production must have **live Execution OS schema (through migration 15 at minimum for 4B table)**, **reprobe and UI proof**, **DBA GO**, **configured app**, **authorized dispatch operator**, **registered pilot order**, and **legacy route containment in effect**.

---

*End of Phase 18 report.*
