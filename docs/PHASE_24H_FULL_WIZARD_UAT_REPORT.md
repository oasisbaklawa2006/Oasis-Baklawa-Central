# PHASE 24H — Merge PR #143, Deploy, Full Wizard UAT Report

**Date:** 2026-06-01  
**Environment:** https://cursor-central-vercel.vercel.app  
**UAT order:** SO-2026-000118 (`8593bda2-8139-4c53-a883-5507124e35fd`)  
**Supabase project:** `tcxvcatsqqertcnycuop` (read-only verification)

---

## 1. PR #143 review

| Check | Result |
|--------|--------|
| Migrations | **None** in PR diff |
| Schema / RLS | **No changes** |
| Scope | Completion/finalization wizard policies, golden-chain derivation, duplicate attest guard, docs |
| Tests | **28** targeted unit tests passed (incl. fix to `dispatchReleaseEligibility.test.ts` describe block) |
| Merge | **PR #143 merged** → `28f02c279598217abe3f76c47961c8c718f6cf88` |

---

## 2. Deployment

| Field | Value |
|--------|--------|
| PR #143 production bundle | `assets/index-XU7uedo-.js` → **`assets/index-ChcGff1e.js`** |
| Post-UAT hotfix on `main` | `4bd7afd` — keep `pre_dispatch` readiness after dispatch |
| Current production bundle | **`assets/index-D15Q1gGE.js`** |
| Deployment ID | `dpl_HS9mzncQqgawqABTZ3Txwmv26Ccj` (READY, SHA `4bd7afd`) |

---

## 3. Wizard UAT (wizard-only, no SQL writes)

### Metrics (combined runs)

| Metric | Value |
|--------|------:|
| Clicks | ~14 |
| Typing | ~46 chars |
| Page switches | ~4 |
| Console | `403` on at least one resource during finalize attempt |

### Stage-by-stage

| Stage | CTA | Result | Notes |
|--------|-----|--------|-------|
| Readiness review | Complete readiness review | **PASS** | → Attest completion |
| Completion attestation | Attest completion | **PASS** | → Finalize dispatch |
| Dispatch finalization | Finalize dispatch | **UI NO_ADVANCE** | SQL shows **success** (see §4) |
| Reserve stock | Reserve stock | **STUCK** | No `inventory_reservations` row created |
| Finalize stock | — | **Not reached** | — |

### UI blocker (finalize)

After clicking **Finalize dispatch**, the sticky CTA remained **Finalize dispatch** for 15s; wizard toast path reports *“Step did not advance”* when `stage`/`cta` unchanged after reload.

### UI blocker (reserve)

After hotfix deploy (`index-D15Q1gGE.js`), wizard correctly showed **Reserve stock** (no regression to readiness). Click did not advance; **0** reservation rows in SQL. Likely **403 / RLS** on reservation write (console 403 observed in session).

---

## 4. Read-only SQL verification (post-UAT)

| Table / field | Expected (full chain) | Actual |
|---------------|----------------------|--------|
| `dispatch_readiness_evidence` | ≥3 + manual review | **4** types verified (`packing_photo`, `document_placeholder`, `gate_scan`, **`manual_readiness_review`**) |
| `operational_scan_records` | 2 | **2** (gate + carton) |
| `finance_review_evidence` | 1 commercial release | **1** |
| `dispatch_completion_evidence` | `completion_attestation` verified | **1** (`2026-06-01 13:40:53 UTC`) |
| `dispatch_release_lineage` | 1 finalize → dispatched | **1** (`release_type=finalize`, `next_status=dispatched`, `2026-06-01 13:41:08 UTC`) |
| `inventory_reservations` | Active → fulfilled | **0** |
| `stock_consumption_lineage` | `consumption_finalized` | **0** |
| `inventory_movements` | `dispatch_consumption_confirmed` | **0** (not queried — no reservation) |
| `orders.status` | `dispatched` | **`dispatched`** |

Order lines: **OAS-PUR-1 × 2** confirmed on `order_items`.

---

## 5. Issues found during 24H

| ID | Severity | Issue |
|----|----------|-------|
| **24H-1** | P2 | After finalize, `readinessPolicy` flipped to `full` when `orders.status=dispatched`, regressing wizard to **Complete readiness review** |
| **24H-1 fix** | — | **`4bd7afd` on `main`** — golden chain always uses `pre_dispatch` |
| **24H-2** | P2 | Finalize **succeeds in DB** but UI may not advance CTA before timeout |
| **24H-3** | **P1** | **Reserve stock** does not persist — blocks stock finalization; investigate reservation RLS / service errors for `dispatch@` |

---

## 6. Final verdict

| Question | Verdict |
|----------|---------|
| **Backend ready?** | **Partial** — readiness, completion, dispatch finalize persist correctly on SO-118; reservation/stock path not proven |
| **Wizard ready?** | **Partial** — PR #143 fixes completion attestation; post-finalize readiness regression fixed on `main`; reserve step still blocked |
| **Operator pilot allowed?** | **No** — cannot complete reserve + stock on wizard alone |
| **Company rollout allowed?** | **No** |

---

## PHASE 24H REPORT — Summary

- **Merged:** PR #143  
- **Deployed:** `index-ChcGff1e.js` (24G) + `index-D15Q1gGE.js` (24H hotfix)  
- **SO-118:** Readiness → completion → **dispatched** in DB; **reserve/stock incomplete**  
- **Stop rule:** Applied at reserve (wizard did not advance)  

**Next:** Fix reservation write path for Golden Chain operator role (403/RLS), re-run reserve + finalize stock on SO-118 or clean SO-119.

---

*End of PHASE 24H report.*
