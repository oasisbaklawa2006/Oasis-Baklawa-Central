# STAGE 14B — Governance UI completion — Implementation report

**Branch:** `cursor/stage-14b-governance-ui-completion-e26c`  
**Base:** `main` @ `b59c865`  
**Scope:** UI + read-model accuracy only — no SQL migrations, no governance rule weakening.

---

## Summary

Stage 14B closes the gaps identified in Stage 14A so an operator can execute the full **4B → 4C → 4D → 4E → 4G** chain using staging admin routes alone. Governance eligibility rules in services/projections are unchanged; the UI now surfaces prerequisites, missing signals, references, and the evidence actions required to satisfy them.

---

## Screenshots (capture on staging)

Capture on **staging** (`aruyieslaxjhnamlstpx`) after logging in as `DISPATCH_MANAGER` / `FINANCE_HEAD` / `INVENTORY_MANAGER` as appropriate. Suggested filenames for PR artifacts:

| # | Route | What to capture |
|---|--------|-----------------|
| 1 | `/admin/dispatch-readiness` | Card with evidence action row + prerequisite checklist |
| 2 | `/admin/finance-governance` | Split “Start finance review” vs “Record commercial release” sections |
| 3 | `/admin/dispatch-completion` | Prerequisites checklist + blockers |
| 4 | `/admin/dispatch-finalization` | Reference panel + finalize disabled hint |
| 5 | `/admin/stock-finalization` | Lineage + reservation linkage + blockers |

> Cloud agent validation: unit tests and typecheck run in CI; live screenshots require staging login (not executed in this environment).

---

## Routes and services

| Board | Route | Bundle / service | Write APIs |
|-------|--------|------------------|------------|
| Dispatch readiness | `/admin/dispatch-readiness` | `createDispatchReadinessBundle` → `dispatchReadinessService` | `addEvidence`, `reviewReadiness` |
| Finance governance | `/admin/finance-governance` | `createFinanceGovernanceBundle` → `financeGovernanceService` | `startReview`, `commercialRelease` |
| Dispatch completion | `/admin/dispatch-completion` | `createDispatchCompletionBundle` → `dispatchCompletionService` | `reviewCompletion`, `attestCompletion` |
| Dispatch finalization | `/admin/dispatch-finalization` | `createDispatchFinalizationBundle` → `dispatchFinalizationService` | `finalizeDispatch`, `publishCustomerRelease` |
| Stock finalization | `/admin/stock-finalization` | `createStockFinalizationBundle` → `stockFinalizationService` | `finalizeConsumption` |

Read models: `loadDispatchReadinessRows`, `loadFinanceGovernanceRows`, `loadDispatchCompletionRows`, `loadDispatchFinalizationRows`, `loadStockFinalizationRows` in `governanceReadQueries.ts` (hook: `useGovernanceBoardState`).

---

## Tables written (operator path)

| Step | Table | Evidence / action types |
|------|--------|-------------------------|
| 4B | `dispatch_readiness_evidence` | `packing_photo`, `document_placeholder`, `gate_scan`, `manual_readiness_review` |
| 4C | `finance_review_evidence` | `credit_review` (pending on review start), `commercial_release` (released) |
| 4D | `dispatch_completion_evidence` | `completion_review`, `completion_attestation` |
| 4E | `dispatch_release_lineage` | `dispatch_finalize` → `orders.status = dispatched` |
| 4G | `inventory_movements`, `stock_consumption_lineage`, `inventory_stock_balances` | via governed `finalizeConsumption` |

Read-only inputs: `operational_scan_records`, `inventory_reservations`, `orders`.

---

## Changes by requirement

### 1. Dispatch readiness

- UI buttons to append `packing_photo`, `document_placeholder`, `gate_scan` via `addEvidence` (verified).
- Prerequisite checklist mirrors dimension rules.
- `missingSignals` from read model shown per card.

### 2. Finance governance

- `startReview` now **persists** `finance_review_evidence` (`credit_review` / `pending`) before event append.
- UI separates **Step 1 review** vs **Step 2 commercial release** with disabled-reason copy.
- Commercial release button uses `validateCommercialReleaseAttempt` + `hasCommercialReleaseEvidence` flag (no duplicate release).

### 3. Dispatch completion

- Explicit prerequisite checklist (4B/4C/4A/security/manifest).
- `missingSignals` + `projection.blockingReasons` on each card.

### 4. Dispatch finalization

- `GovernanceReferencePanel` for gate / completion / transporter references.
- `GovernanceActionDisabledHint` explains why finalize is disabled.

### 5. Stock finalization

- Multi-order grid from live rows.
- Exact blockers, dispatch lineage id/refs, reservation list per order.

### Read-model (not rule change)

- `deriveReservationReadinessForOrder` + `loadReservationStatusesByOrder` replace hardcoded `reservationReady: true` / `reservationStatus: "reserved"` in completion, finalization, readiness, and finance fusion.

---

## New / updated files

| File | Purpose |
|------|---------|
| `src/components/admin/GovernanceBoardPrerequisites.tsx` | Shared missing signals, blockers, references, checklist |
| `src/lib/execution-read-models/reservationReadinessFusion.ts` | Reservation readiness from `inventory_reservations` |
| `src/pages/admin/*Board.tsx` (5) | Stage 14B UI surfaces |
| `src/lib/finance-governance/financeGovernanceService.ts` | Persist review evidence on start |
| `src/lib/execution-read-models/queries/governanceReadQueries.ts` | Live reservation + finance evidence flags |
| `docs/EXECUTION_OS_GOLDEN_CHAIN_UI_RUNBOOK.md` | Operator golden-chain runbook |

---

## Tests

- `financeGovernanceService.test.ts` — `startReview` persists `credit_review`
- `governanceGoldenChain.test.ts` — golden chain finance review evidence
- `reservationReadinessFusion.test.ts` — reservation derivation cases
- All `execution-read-models` tests (145 in targeted run)

---

## Updated runbook

See **[EXECUTION_OS_GOLDEN_CHAIN_UI_RUNBOOK.md](./EXECUTION_OS_GOLDEN_CHAIN_UI_RUNBOOK.md)** for the end-to-end staging walkthrough.

Phase-specific checklists remain in `docs/EXECUTION_OS_PHASE4*_STAGING_VALIDATION.md`.

---

## Governance guarantees preserved

- No changes to `projectDispatchReadiness`, `projectFinanceRelease`, `projectDispatchCompletion`, `projectDispatchRelease`, or stock eligibility functions.
- No new bypass flags or weakened authority guards.
- Finalize still requires fused references and attested completion; stock finalize still requires `dispatch_finalized` + scan + reservations.
