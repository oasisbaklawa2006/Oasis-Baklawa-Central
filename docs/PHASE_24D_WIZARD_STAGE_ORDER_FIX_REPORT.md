# PHASE 24D — Golden Chain Wizard Stage Order Fix Report

**Date:** 2026-06-01  
**Scope:** Wizard-only flow for `cleared_for_dispatch` orders — no migrations, no schema changes, no RLS weakening

---

## 1. Problem (24C)

The wizard started at readiness review (4B) while `projectDispatchReadiness` required finance signal, operational scans, packing/document/gate evidence, and **reservation** — before finance release or reservation board prep. Operators got `exception_blocked` and duplicate readiness evidence rows.

---

## 2. New stage order (staff-facing)

| Order | Internal stage | CTA |
|------:|----------------|-----|
| 1 | `prepare_dispatch_evidence` | **Prepare dispatch evidence** |
| 2 | `finance_release` | **Complete finance release** |
| 3 | `readiness_review` | **Complete readiness review** |
| 4 | `completion_attestation` | **Attest completion** |
| 5 | `dispatch_finalization` | **Finalize dispatch** |
| 6 | `reservation` | **Reserve stock** |
| 7 | `stock_finalization` | **Finalize stock** |
| 8 | `complete` | **Already complete** |

**Reservation policy:** Reservation is **not** required before readiness review on pre-dispatch orders. `readinessPolicy: "pre_dispatch"` skips the `reservation_ready` dimension in `evaluateAllDimensions`. Reservation remains **after** dispatch finalization (unchanged business order).

**Finance policy:** For `cleared_for_dispatch` orders, finance stage derivation treats `reservationReady: true` and `dispatchReadinessGateEligible` from prepared evidence (reservation is post-finalize). Commercial release evidence or `commercially_released` projection advances past finance.

---

## 3. Files changed

| File | Change |
|------|--------|
| `src/lib/golden-chain-operator/goldenChainTypes.ts` | New stage/CTA constants |
| `src/lib/golden-chain-operator/goldenChainStageDerivation.ts` | Prerequisite-ordered derivation |
| `src/lib/golden-chain-operator/goldenChainPrerequisites.ts` | Evidence + scan prepared checks |
| `src/lib/golden-chain-operator/goldenChainPrepareDispatchEvidence.ts` | Idempotent prepare (evidence + scans) |
| `src/lib/golden-chain-operator/goldenChainOrderQueries.ts` | Slices, `pre_dispatch`, finance flags |
| `src/lib/golden-chain-operator/goldenChainBlockers.ts` | Stage labels / humanized blockers |
| `src/lib/golden-chain/deriveGoldenChainStage.ts` | Staff stage mapping (24D names) |
| `src/pages/admin/GoldenChainOperatorWizard.tsx` | Split prepare vs readiness review actions |
| `src/lib/dispatch-readiness/dispatchReadinessTypes.ts` | `readinessPolicy` |
| `src/lib/dispatch-readiness/dispatchReadinessRules.ts` | Skip reservation when `pre_dispatch` |
| `src/lib/golden-chain-operator/__tests__/goldenChainStageOrder.test.ts` | **New** stage-order tests |
| `src/lib/golden-chain-operator/__tests__/goldenChainOperator.test.ts` | Updated expectations |
| `src/lib/golden-chain/__tests__/deriveGoldenChainStage.test.ts` | Updated expectations |

---

## 4. Readiness prerequisite logic

**Prepare dispatch evidence** (must all be true before finance):

- `dispatch_readiness_evidence`: `packing_photo`, `document_placeholder`, `gate_scan` — each **verified**
- `operational_scan_records`: `dispatch_gate` + `carton` — **verified**

**Finance release** (before readiness review):

- `finance_review_evidence` with `commercial_release` / `released`, **or**
- Relaxed `projectFinanceRelease` for pre-dispatch chain input (advance/credit satisfied; reservation not gating)

**Readiness review** (single action):

- Calls `reviewReadiness` only (no bulk evidence insert)
- Uses `readinessPolicy: "pre_dispatch"` (no reservation dimension)
- Fails fast if projection ≠ `gate_eligible`

---

## 5. Scan / carton preparation fix

`prepareDispatchEvidenceForOrder` uses:

- `DispatchReadinessBundle.service.addEvidence` (governed, append-only)
- `recordVerifiedScanForStockFinalization` for `dispatch_gate` and `carton` (existing scan repository + idempotency keys)

**Duplicate guard:** Skips insert when verified row/scan already exists; UI toast **“Already recorded”** when everything was skipped.

---

## 6. Tests

```
✓ goldenChainStageOrder.test.ts (6)
✓ goldenChainOperator.test.ts (7)
✓ deriveGoldenChainStage.test.ts (7)
```

Covers: start at `prepare_dispatch_evidence`, finance before readiness, `pre_dispatch` gate without reservation, dispatch finalization path, no duplicate evidence on prepare, complete after consumption.

---

## 7. UAT (production)

**Status:** Pending deploy of this branch to https://cursor-central-vercel.vercel.app

**Recommended order:** SO-2026-000026 or new greenfield SO after buyer intake fix.

**Expected wizard-only path after deploy:**

1. Prepare dispatch evidence → advance  
2. Finance login → Complete finance release → advance  
3. Complete readiness review → `gate_eligible`  
4. Attest completion → Finalize dispatch → Reserve stock → Finalize stock  

**24C baseline (pre-fix):** ~13 clicks, stuck at 4B — see `docs/PHASE_24C_CLEAN_WIZARD_UAT_REPORT.md`

---

## 8. Rollout verdict

| Question | Verdict |
|----------|---------|
| **Backend ready?** | **Yes** (unchanged services; ordering fix is app-layer) |
| **Wizard ready (post-deploy)?** | **Yes** — prerequisite-ordered CTAs, idempotent prepare, no 4B-first trap |
| **Operator pilot?** | **Allowed after one clean production UAT pass** on this build |
| **Company rollout?** | **No** until pilot UAT records full 8-step chain on a clean SO |

---

**PHASE 24D FINAL:** Stage ordering and prerequisite preparation **implemented**; production UAT **required after deploy** to confirm click/typing metrics and SQL stage matrix.
