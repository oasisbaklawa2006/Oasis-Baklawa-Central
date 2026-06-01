# PHASE 24K — Clean 3-Order Wizard Pilot Report

**Date:** 2026-06-01  
**Environment:** https://cursor-central-vercel.vercel.app  
**Path:** `/admin/golden-chain-operator` (wizard only — no six-board actions)  
**Production deploy:** `97571eb` (`index-Dyh4tz0u.js`)

---

## Executive summary

Phase 24K delivered **finalize CTA polish** (dispatch finalize → **Reserve stock** without sticking on **Finalize dispatch**) and ran a **clean finance-clear 3-order wizard pilot** end-to-end. All seven wizard steps passed on **SO-2026-000136**, **SO-2026-000137**, and **SO-2026-000138** with SQL verification aligned to governance expectations.

| Verdict | Result |
|---------|--------|
| **Backend ready?** | **Yes** — finalize, reservation, stock consumption, and fulfillment sync behave correctly on pilot orders. |
| **Wizard ready?** | **Yes** — after `97571eb` (optimistic CTA + load/view drift normalization). |
| **Operator pilot passed?** | **Yes** — 3/3 orders, 7/7 stages each. |
| **Limited department rollout allowed?** | **Yes (conditional)** — dispatch + finance heads on wizard only; monitor first week. |
| **Company rollout allowed?** | **No** — complete supervised UAT on additional SKUs/lanes and confirm stock edge cases before broad rollout. |

---

## Part A — Finalize CTA polish

### Root cause

After `finalizeDispatch`, the database often showed `orders.status = dispatched` and a `dispatch_release_lineage` finalize row, but the wizard could keep **Finalize dispatch** because:

1. In-memory order state lagged (status still `cleared_for_dispatch`, lineage not yet in the client slice).
2. Post-mutation reload could return stale derivation before read-after-write settled.
3. Drift normalization was not applied on every load/render path.

### Fix (commits on `main`)

| File | Change |
|------|--------|
| `src/lib/golden-chain-operator/goldenChainReloadAfterMutation.ts` | Drift detection + `normalizeGoldenChainStateAfterDispatchFinalize`; reload predicate accepts normalized post-finalize state. |
| `src/lib/golden-chain-operator/goldenChainOrderQueries.ts` | Normalize state on every `loadGoldenChainOrderState` return. |
| `src/pages/admin/GoldenChainOperatorWizard.tsx` | Dedicated post-finalize reload path; `viewState` for CTA; **optimistic** advance to Reserve stock immediately after successful finalize; recover when DB already dispatched despite non-idempotent errors. |
| `src/lib/golden-chain-operator/__tests__/goldenChainFinalizeAdvance.test.ts` | Derivation + drift normalization tests. |
| `tests/phase-24k-finalize-cta.spec.ts` | Dispatched order opens on **Reserve stock**. |

### Expected operator behavior

1. Click **Finalize dispatch** → toast: *Dispatch finalized. Continue to reserve stock.*
2. Sticky CTA becomes **Reserve stock** (no 45s stickiness).
3. Duplicate finalize blocked (`already_finalized` / lineage guard); UI stays on reservation flow.

---

## Part B — Clean pilot order seeding

**Product:** OAS-PUR-1 × 2 · **Company:** `4746e3d5-82a9-42bd-ab59-2b2951c52057`

| SO | Order ID | Seeded for pilot | Notes |
|----|----------|------------------|-------|
| SO-2026-000119 – 000135 | various | Attempted earlier | Partial runs; finalize CTA stuck pre-`97571eb`. |
| **SO-2026-000136** | `a1360000-0000-4000-8000-000000000136` | **Primary pilot #1** | Clean seed → full 7-step pass. |
| **SO-2026-000137** | `a1370000-0000-4000-8000-000000000137` | **Primary pilot #2** | Clean seed → full 7-step pass. |
| **SO-2026-000138** | `a1380000-0000-4000-8000-000000000138` | **Primary pilot #3** | Clean seed → full 7-step pass. |

**Seed shape (SQL, orders + order_items only):**

- `status = cleared_for_dispatch`
- `payment_status = verified_advance`, `payment_cleared = true`
- `advance_paid >= advance_required`
- No governance evidence, lineage, reservation, or stock rows at seed time
- Explicit `tracking_token` on insert (hosted SQL context)

---

## Part C — Wizard-only pilot execution

**Harness:** `tests/phase-24k-clean-pilot.spec.ts`  
**Flags:** `ALLOW_FINANCE_E2E_MUTATIONS=true`  
**Accounts:** `dispatch@oasisbaklawa.com` / `finance@oasisbaklawa.com`

### Aggregate metrics (per order)

| SO | Clicks | Typing (chars) | Page switches | Duration (approx.) | Errors |
|----|-------:|---------------:|--------------:|-------------------:|--------|
| SO-2026-000136 | 19 | 130 | 6 | ~101 s | 0 |
| SO-2026-000137 | 19 | 130 | 6 | ~97 s | 0 |
| SO-2026-000138 | 19 | 130 | 6 | ~96 s | 0 |

### Stage results (all three orders)

| Step | CTA | SO-136 | SO-137 | SO-138 |
|------|-----|--------|--------|--------|
| 1 Prepare evidence | Prepare dispatch evidence | PASS | PASS | PASS |
| 2 Finance | Complete finance release | PASS | PASS | PASS |
| 3 Readiness | Complete readiness review | PASS | PASS | PASS |
| 4 Completion | Attest completion | PASS | PASS | PASS |
| 5 Finalize | Finalize dispatch → **Reserve stock** | PASS | PASS | PASS |
| 6 Reservation | Reserve stock → Finalize stock | PASS | PASS | PASS |
| 7 Stock | Finalize stock → **Already complete** | PASS | PASS | PASS |

**Finalize CTA:** `finalizeAdvancedToReserve = true` on all three orders.

---

## Part D — SQL verification

**WH-MAIN OAS-PUR-1 stock:** `available_qty` **38 → 32** (Δ −6 = 3 × 2 units) · `version` 7 → 10

| Check | SO-136 | SO-137 | SO-138 |
|-------|--------|--------|--------|
| `dispatch_readiness_evidence` (required rows) | 4 | 4 | 4 |
| `operational_scan_records` verified | 2 | 2 | 2 |
| `finance_review_evidence` commercial_release released | 1 | 1 | 1 |
| `dispatch_completion_evidence` completion_attestation verified | 1 | 1 | 1 |
| `dispatch_release_lineage` finalize rows | 1 | 1 | 1 |
| `orders.status` | dispatched | dispatched | dispatched |
| `payment_cleared` | true | true | true |
| `inventory_reservations` fulfilled (`fulfilled_qty=2`, `reserved_qty=0`) | 1 | 1 | 1 |
| `stock_consumption_lineage` consumption_finalized | 1 | 1 | 1 |
| `inventory_movements` dispatch_consumption_confirmed (via reservation) | 1 | 1 | 1 |

---

## Part E — Defects and follow-ups

| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| DEF-24K-01 | P0 | Finalize CTA stuck on **Finalize dispatch** after successful DB finalize | **Fixed** (`97571eb`) |
| DEF-24K-02 | P2 | Early pilot orders (119–135) polluted by failed finalize attempts | Document only — use 136–138 as canonical pilot |
| DEF-24K-03 | P3 | Playwright pilot ~5 min for 3 orders (12s wait per non-finalize step) | Acceptable for automation; operators faster |

**Out of scope (unchanged):** WhatsApp, invoice, payment gateway, customer notifications, six-board UI actions, schema/RLS changes.

---

## Files changed (this phase)

- `src/pages/admin/GoldenChainOperatorWizard.tsx`
- `src/lib/golden-chain-operator/goldenChainOrderQueries.ts`
- `src/lib/golden-chain-operator/goldenChainReloadAfterMutation.ts`
- `src/lib/golden-chain-operator/goldenChainStageDerivation.ts` (prior PR #147)
- `src/lib/golden-chain-operator/__tests__/goldenChainFinalizeAdvance.test.ts`
- `tests/phase-24k-clean-pilot.spec.ts`
- `tests/phase-24k-finalize-cta.spec.ts`
- `docs/PHASE_24K_CLEAN_3_ORDER_WIZARD_PILOT_REPORT.md`

---

## Final verdict (PHASE 24K)

| Question | Answer |
|----------|--------|
| Backend ready? | **Yes** |
| Wizard ready? | **Yes** (production `97571eb`) |
| Operator pilot passed? | **Yes** (SO-136/137/138) |
| Limited department rollout allowed? | **Yes (conditional)** |
| Company rollout allowed? | **No** |
