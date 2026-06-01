# PHASE 24G — Completion Alignment Wizard Fix & UAT Report

**Date:** 2026-06-01  
**Environment:** https://cursor-central-vercel.vercel.app  
**PR:** [#143](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/143) — `cursor/phase-24g-completion-alignment-646d`  
**Supabase project:** `tcxvcatsqqertcnycuop` (read-only verification)

---

## 1. Problem (PHASE 24F)

On **SO-2026-000118**, wizard completed prepare + finance, then showed **Attest completion** but the CTA did not advance.

| Root cause | Detail |
|------------|--------|
| Stage order (24D) | Completion → finalize → **reservation** → stock |
| Strict `completionInput` | Required `reservationReady`, `completion_review` security, courier manifest from **completion** evidence |
| Mismatch | Wizard offered attestation before prerequisites the 4D board expects **after** reservation |

Dispatch Completion Board “succeeds” in pilots via **Step 1 — Review completion**, which writes `completion_review` evidence before attest — not via the Golden Chain prepare path alone.

---

## 2. Solution chosen (and why)

**Chosen:** `completionPolicy: "pre_dispatch_wizard"` + `finalizationPolicy: "pre_dispatch_wizard"` on governance inputs built in `loadGoldenChainOrderState`.

**Not chosen:** Extend prepare to insert `completion_review` / manifest placeholders into `dispatch_completion_evidence`.

| Option | Verdict |
|--------|---------|
| Policy on existing projection | **Selected** — mirrors `readinessPolicy: "pre_dispatch"`; no extra append-only rows; boards keep strict `full` policy |
| Prepare-stage completion spam | Rejected — mixes readiness and completion evidence; harder to audit |

### Policy behavior

**`pre_dispatch_wizard` completion** (`buildGoldenChainWizardCompletionInput`):

- `reservationReady: true` (reservation is a later wizard stage)
- `securityGatePassed` from verified dispatch gate scan (prepare) when no scan rejection/mismatch
- `courierManifestAttached` from verified `document_placeholder` or commercial finance release
- `completionPolicy: "pre_dispatch_wizard"` — eligibility skips reservation blocker

**`pre_dispatch_wizard` finalization:**

- `reservationReady: true` before dispatch finalize
- `completionStatus` synced from attestation evidence

**Readiness clarity:**

- Wizard requires **`manual_readiness_review` verified** before completion (even if `gate_scan` alone would derive `gate_eligible`)
- After finance on SO-118, CTA is **Complete readiness review** until operator runs review (records `manual_readiness_review`)

**Duplicate guard:**

- `attestCompletion` rejects second `completion_attestation` verified row
- Wizard disabled CTA / toast: “Completion already attested.”

---

## 3. Files changed

| File | Change |
|------|--------|
| `src/lib/dispatch-completion/dispatchCompletionTypes.ts` | `DispatchCompletionPolicy`, optional `completionPolicy` |
| `src/lib/dispatch-completion/dispatchCompletionEligibility.ts` | Wizard policy skips reservation requirement |
| `src/lib/dispatch-completion/dispatchCompletionService.ts` | Duplicate attestation guard |
| `src/lib/dispatch-finalization/dispatchFinalizationTypes.ts` | `DispatchFinalizationPolicy` |
| `src/lib/dispatch-finalization/dispatchReleaseEligibility.ts` | Wizard policy skips reservation for finalize |
| `src/lib/golden-chain-operator/goldenChainCompletionInput.ts` | **New** — wizard completion input builder |
| `src/lib/golden-chain-operator/goldenChainOrderQueries.ts` | Applies wizard completion + finalization inputs |
| `src/lib/golden-chain-operator/goldenChainStageDerivation.ts` | Manual readiness gate; `completionAttested` advances chain |
| `src/lib/golden-chain-operator/goldenChainTypes.ts` | CTA `Completion already attested` |
| `src/pages/admin/GoldenChainOperatorWizard.tsx` | Already-attested handling |
| Tests (6 files) | Policy, duplicate, stage order, finalization |
| `tests/phase-24g-full-wizard-uat.spec.ts` | Production UAT harness |

---

## 4. Tests run

```text
✓ dispatchCompletionEligibility.test.ts (2)
✓ dispatchCompletionService.test.ts (5, incl. duplicate attest)
✓ goldenChainCompletionInput.test.ts (2)
✓ goldenChainStageOrder.test.ts (8)
✓ goldenChainOperator.test.ts (7)
✓ dispatchReleaseEligibility.test.ts (4)
```

All **28** targeted tests passed locally.

---

## 5. UAT order

| Field | Value |
|--------|--------|
| **SO** | **SO-2026-000118** |
| **Pre-UAT SQL** | `fre=1`, `dce=0`, `dre=3`, scans=2, `status=cleared_for_dispatch` |
| **SO-2026-000119** | Not created — 118 still clean for continuation |

---

## 6. Production UAT (pre-merge baseline)

Playwright against **current production** (before PR #143 deploy):

| Metric | Value |
|--------|------:|
| Clicks | 4 |
| Typing | 44 chars |
| Page switches | 2 |
| Result | **STUCK** at first step — CTA already **Attest completion** (24F behavior) |

This confirms production still runs pre-24G derivation. **Re-run** `tests/phase-24g-full-wizard-uat.spec.ts` after merge/deploy.

### Expected post-deploy stage flow (SO-118)

| # | Stage | Expected CTA |
|---|--------|----------------|
| 1 | Prepare | Skip or pass (evidence exists) |
| 2 | Finance | Skip (already released) |
| 3 | Readiness | **Complete readiness review** |
| 4 | Completion | **Attest completion** → advances |
| 5 | Finalize | **Finalize dispatch** |
| 6 | Reservation | **Reserve stock** |
| 7 | Stock | **Finalize stock** |

### Expected post-deploy SQL

| Table | Expected |
|--------|----------|
| `dispatch_completion_evidence` | ≥1 `completion_attestation` / `verified` |
| `dispatch_release_lineage` | 1 finalize row |
| `inventory_reservations` | Active then **fulfilled** after stock |
| `stock_consumption_lineage` | `consumption_finalized` |
| `inventory_movements` | `dispatch_consumption_confirmed` |
| `orders.status` | `dispatched` |

---

## 7. Read-only SQL (pre-deploy, SO-118)

| Table | Count |
|--------|------:|
| `dispatch_readiness_evidence` | 3 |
| `operational_scan_records` | 2 |
| `finance_review_evidence` | 1 |
| `dispatch_completion_evidence` | 0 |
| `dispatch_release_lineage` | 0 |
| `inventory_reservations` | 0 |
| `stock_consumption_lineage` | 0 |
| `orders.status` | `cleared_for_dispatch` |

---

## 8. Final verdict

| Question | Verdict | Notes |
|----------|---------|-------|
| **Backend ready?** | **Yes (with deploy)** | Policies implemented; duplicate attest guarded; unit tests green |
| **Wizard ready?** | **Yes (with deploy)** | Completion + finalize aligned to 24D order; readiness review explicit |
| **Operator pilot allowed?** | **After deploy + one clean SO UAT** | Re-run full chain on SO-118 post-merge |
| **Company rollout allowed?** | **No** | Awaiting post-deploy E2E proof on production |

---

## PHASE 24G REPORT — Summary

- **Fix:** `pre_dispatch_wizard` completion + finalization policies; manual readiness required; duplicate attestation blocked  
- **PR:** #143  
- **UAT order:** SO-2026-000118  
- **Pre-deploy prod UAT:** Blocked at legacy “Attest completion” (expected)  
- **Next:** Merge #143 → deploy → re-run `phase-24g-full-wizard-uat.spec.ts` → confirm SQL matrix  

---

*End of PHASE 24G report.*
