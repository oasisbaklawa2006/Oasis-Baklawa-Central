# PHASE 24F — Clean Finance-Clear Golden Chain Wizard UAT Report

**Date:** 2026-06-01  
**Environment:** Production only — https://cursor-central-vercel.vercel.app  
**Supabase project:** `tcxvcatsqqertcnycuop` (SQL for UAT order setup + read-only verification)  
**Scope:** One finance-clear order, wizard-only actions (no six-board flow, no SQL writes for governance steps), no migrations/schema changes

---

## Executive summary

PHASE 24F attempted a **full** Golden Chain wizard run on an order with **no finance hold** and **no compliance_review_pending**, after PHASE 24D/24E stage-order fixes and a production hotfix for finance-stage skipping.

| Outcome | Detail |
|--------|--------|
| **Clean UAT order** | **SO-2026-000118** (`8593bda2-8139-4c53-a883-5507124e35fd`) |
| **Stages completed (wizard)** | Prepare dispatch evidence → Complete finance release |
| **Stop point** | **Attest completion** — CTA visible but action does not advance; governance service rejects attestation |
| **Full chain (7 CTAs)** | **Not completed** — per task rules, UAT stopped here |
| **Production fix landed** | `db98726` — finance stage no longer skipped without `finance_review_evidence` + `financeSignal: ready` |

---

## 1. Deployment and prerequisites

| Item | Value |
|------|--------|
| Base merge | PR #140 (`e33db55`) — wizard stage order 24D |
| Hotfix on `main` | `db98726` — `financeCommerciallyReleased` requires evidence or `financeSignal === "ready"` |
| Production bundle (observed) | `assets/index-XU7uedo-.js` |
| Wizard route | `/admin/golden-chain-operator` |

---

## 2. Clean UAT order — find or create

### 2.1 Pool scan (read-only)

No existing production order simultaneously satisfied:

- `status = cleared_for_dispatch`
- `payment_status = verified_advance`
- `payment_cleared = true`
- No `compliance_review_pending` / finance hold on fusion
- No prior `finance_review_evidence`, `dispatch_release_lineage`, or `stock_consumption_lineage`

Orders such as **SO-2026-000026** and **SO-2026-000013** remained blocked by finance/compliance holds (PHASE 24E finding).

### 2.2 Created orders (SQL allowed for setup only)

| SO | Order ID | Role in 24F |
|----|----------|-------------|
| **SO-2026-000117** | `dcea1876-d8f4-430e-916f-e1410d9cf7a1` | Early attempt; polluted (finance evidence 0, readiness rows include `manual_readiness_review:pending`; wizard reached readiness without finance). **Not used for final verdict.** |
| **SO-2026-000118** | `8593bda2-8139-4c53-a883-5507124e35fd` | **Primary UAT order** |

**SO-2026-000118 setup (summary):**

- `status`: `cleared_for_dispatch`
- `payment_status`: `verified_advance`, `payment_cleared`: true
- `advance_paid` / `advance_required`: 1300 / 1298 (advance satisfied)
- Line: **OAS-PUR-1 × 2**
- No finance hold, no compliance hold on pre-flight
- Stock at WH-MAIN available for SKU (observed `available_qty: 40` in session)

Insert required explicit `tracking_token` (DB trigger `gen_random_bytes` unavailable in hosted SQL context).

---

## 3. Finance projection pre-UAT (SO-118)

After `db98726` deploy, pre-flight on SO-118 (relaxed golden-chain finance input — same pattern as wizard `finance_release` handler):

| Check | Result |
|--------|--------|
| `validateCommercialReleaseAttempt` | **Allowed** |
| Finance hold | **None** |
| `compliance_review_pending` | **None** |
| Commercial release possible | **Yes** (wizard subsequently persisted `finance_review_evidence`) |

Finance stage derivation uses relaxed `reservationReady: true` before dispatch finalize (see `goldenChainOrderQueries.ts`).

---

## 4. Wizard-only UAT execution

### 4.1 Method

- Playwright against production (`ALLOW_FINANCE_E2E_MUTATIONS=true`)
- **Dispatch:** `dispatch@oasisbaklawa.com` / `dispatch_head`
- **Finance:** `finance@oasisbaklawa.com` / `finance_head`
- Actions: sticky primary CTA on Golden Chain wizard only

Harness (local, not required for operators): `tests/phase-24f-clean-finance-wizard-uat.spec.ts`, `tests/phase-24f-finish-wizard-uat.spec.ts`

### 4.2 Metrics (partial run through finance; completion re-probed)

| Metric | Value | Notes |
|--------|------:|-------|
| **Clicks** | ~18 | Login, search, order pick, prepare, finance, completion attempt |
| **Typing (chars)** | ~130 | Credentials + order search (`000118`) |
| **Page switches** | ~6 | Login ↔ wizard |
| **Errors** | 1 blocking | Attest completion stuck |
| **CTA advanced after prepare** | Yes | → Complete finance release |
| **CTA advanced after finance** | Yes | → Attest completion (readiness CTA skipped) |
| **CTA advanced after attest** | **No** | Label unchanged after 15s wait |
| **Duplicate finalize tested** | No | Did not reach Finalize dispatch |
| **Reservation → fulfilled after stock** | No | Not reached |

### 4.3 Per-stage results

| # | Wizard stage | Expected CTA | Result | CTA after step |
|---|--------------|--------------|--------|----------------|
| 1 | Prepare dispatch evidence | Prepare dispatch evidence | **PASS** | Complete finance release |
| 2 | Finance release | Complete finance release | **PASS** | Attest completion |
| 3 | Readiness review | Complete readiness review | **SKIPPED (derivation)** | N/A — `gate_eligible` from `gate_scan` without `manual_readiness_review` |
| 4 | Completion attestation | Attest completion | **STUCK** | Attest completion (no advance) |
| 5 | Dispatch finalization | Finalize dispatch | **Not reached** | — |
| 6 | Reservation | Reserve stock | **Not reached** | — |
| 7 | Stock finalization | Finalize stock | **Not reached** | — |

**Stop rule applied:** wizard action failed to advance at stage 4.

### 4.4 Blockers at Attest completion (SO-118)

`projectDispatchCompletion` / `attestCompletion` use **strict** `completionInput` from `deriveCompletionInputFromSlices` (`reservationReady: activeReservations.length > 0`). Unlike finance, the wizard **does not** pass relaxed completion input on CTA click.

Observed blocking reasons (fusion + eligibility):

1. **Inventory reservation not ready** — `inventory_reservations` count = 0 (reservation stage is **after** completion in 24D order)
2. **Security gate clearance not recorded** — requires `completion_review` verified in `dispatch_completion_evidence`, not dispatch gate scan alone
3. **Courier manifest / handoff reference missing** — requires `completion_attestation` or `completion_review` completion evidence

Re-probe (2026-06-01): `phase-24f-finish-wizard-uat.spec.ts` on desktop — `Attest completion -> Attest completion`, error `Stuck on Attest completion`.

---

## 5. Read-only SQL verification (SO-2026-000118)

**Order ID:** `8593bda2-8139-4c53-a883-5507124e35fd`

### 5.1 Governance tables

| Table | Count | Notes |
|-------|------:|-------|
| `dispatch_readiness_evidence` | **3** | `packing_photo`, `document_placeholder`, `gate_scan` — all `verified` |
| `operational_scan_records` | **2** | `dispatch_gate` + `carton`, both `verified` |
| `finance_review_evidence` | **1** | `commercial_release` / `released` |
| `dispatch_completion_evidence` | **0** | Attestation never persisted |
| `dispatch_release_lineage` | **0** | — |
| `inventory_reservations` | **0** | — |
| `stock_consumption_lineage` | **0** | — |
| `inventory_movements` | **0** | (no rows tied to this order in verification pass) |

### 5.2 Readiness evidence detail

| evidence_type | evidence_status | evidence_ref |
|---------------|-----------------|--------------|
| packing_photo | verified | PACKING-SO-2026-000118 |
| document_placeholder | verified | DOC-SLOT-SO-2026-000118 |
| gate_scan | verified | GATE-SO-2026-000118 |

No `manual_readiness_review` row on SO-118.

### 5.3 Finance evidence detail

| review_type | review_status | evidence_type |
|-------------|---------------|---------------|
| commercial_release | released | commercial_release |

### 5.4 Operational scans

| scan_type | verification_status | barcode_value |
|-----------|----------------------|---------------|
| dispatch_gate | verified | GATE-SO-2026-000118 |
| carton | verified | CTN-SO-2026-000118 |

### 5.5 Order header (post-UAT)

| Field | Value |
|--------|--------|
| `orders.status` | `cleared_for_dispatch` (unchanged — expected until dispatch finalize path runs) |
| `payment_status` | `verified_advance` |
| `payment_cleared` | true |

---

## 6. Defects and fixes

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| **24F-1** | P0 (fixed) | Wizard skipped **Complete finance release** when fusion projected `commercially_released` without evidence / while `financeSignal` was `pending_review` | **Fixed** `db98726` on `main` |
| **24F-2** | P2 (product) | **Complete readiness review** CTA skipped when `deriveReadinessStatusFromEvidence` returns `gate_eligible` from `gate_scan` only (no explicit manual review row) | Open — may be acceptable if policy = evidence-derived gate |
| **24F-3** | **P0 (open)** | Wizard shows **Attest completion** before prerequisites satisfied; attestation uses strict `completionInput` (reservation + completion-specific evidence) while stage order places reservation **after** completion | **Blocks full wizard UAT** |
| **24F-4** | P1 (open) | Completion security/manifest flags derived from `dispatch_completion_evidence`, not from prepare-phase gate/carton scans | Contributes to 24F-3 |

### Fix reference (24F-1)

```371:376:src/lib/golden-chain-operator/goldenChainOrderQueries.ts
  const financeCommerciallyReleased =
    (financeEvidence ?? []).some(
      (e) => e.review_type === "commercial_release" && e.review_status === "released",
    ) ||
    (financeFusion.financeSignal === "ready" &&
      projectFinanceRelease(financeInputForChain).releaseStatus === "commercially_released");
```

### Recommended follow-up (24F-3 / 24F-4)

Align wizard with golden-chain stage order (pick one):

1. **Relax `completionInput` for wizard attest** (mirror finance: `reservationReady: true` pre-finalize, map gate scan → security clearance, placeholder manifest), **or**
2. **Reorder stages** so reservation (and optionally dispatch finalize) precede completion attestation, **or**
3. **Extend prepare dispatch evidence** to write completion prerequisite evidence types consumed by `deriveCompletionInputFromSlices`.

---

## 7. Acceptance criteria (task checklist)

| Task | Status |
|------|--------|
| 1. Find/create clean UAT order | **Done** — SO-2026-000118 |
| 2. Confirm finance projection | **Done** — release allowed; no holds |
| 3. Run full wizard-only flow (7 steps) | **Failed** — stopped at step 4 |
| 4. Measure clicks/typing/switches/errors/advance | **Partial** — see §4.2 |
| 5. Read-only SQL verification | **Done** — see §5 |
| 6. Create this report | **Done** |

---

## 8. Final verdict

| Question | Verdict | Rationale |
|----------|---------|-----------|
| **Backend ready?** | **Partial** | Finance commercial release and prepare evidence paths persist correctly on a clean order. Completion attestation, dispatch finalize, reservation, and stock paths were **not** exercised end-to-end on SO-118. |
| **Wizard ready?** | **Partial** | First two stages work on finance-clear data after `db98726`. Full operator chain **not** ready due to **24F-3** (completion CTA vs service prerequisites / stage order). |
| **Operator pilot allowed?** | **No** | Cannot complete one SO through wizard without workaround; stop at attestation. |
| **Company rollout allowed?** | **No** | Same blocker; no proof of duplicate-finalize guard or reservation→fulfilled stock path in this UAT. |

---

## PHASE 24F REPORT — Summary

- **Order:** SO-2026-000118 (clean finance-clear UAT SO)
- **Passed:** Prepare dispatch evidence, Complete finance release
- **Skipped:** Complete readiness review (evidence-derived `gate_eligible`)
- **Failed / stopped:** Attest completion (no CTA advance, 0 completion evidence rows)
- **Not run:** Finalize dispatch, Reserve stock, Finalize stock
- **Hotfix shipped:** Finance stage skip (`db98726`)
- **Open blocker:** Completion attestation vs 24D stage order and strict completion fusion ( **P0** )

---

*End of PHASE 24F report.*
