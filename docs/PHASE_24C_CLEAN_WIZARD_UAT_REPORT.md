# PHASE 24C — Clean Greenfield Wizard UAT Report

**Date:** 2026-06-01  
**Environment:** Production app only — https://cursor-central-vercel.vercel.app  
**Supabase project:** `tcxvcatsqqertcnycuop` (read-only verification via staff JWT)  
**Scope:** Merge/deploy PR #137, clean UAT order, wizard-only E2E (no SQL writes for governance actions, no migrations)

---

## 1. PR #137 review and merge status

| Check | Result |
|--------|--------|
| PR | [#137](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/137) — **MERGED** |
| Merge commit | `6695d2e1580430bdf67389a2947f66360d66e26e` |
| UUID search fix | **Confirmed** — `searchGoldenChainOrders` uses `order_number` `ilike` only; removed invalid `id.ilike` on UUID (PostgREST `uuid ~~* unknown`) |
| Migration files | **None** |
| Unrelated product changes | **None** (search fix + Phase 24B report + Playwright harness) |
| CI at merge | Release Quality Gate **SUCCESS** (per merge) |

**Follow-up PR #138** (merged same day, supports 24C staging):

| Check | Result |
|--------|--------|
| PR | [#138](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/138) — **MERGED** |
| Merge commit | `54e1d6a5b63e879c1800eb878c35c8a6ff86c5bb` |
| Wizard readiness reload before `reviewReadiness` | **Yes** — `GoldenChainOperatorWizard.tsx` |
| Reservation board gate + carton scan buttons | **Yes** — `ReservationGovernancePanel.tsx` |
| Migration files | **None** |

---

## 2. Production deployment status

| Field | Value |
|--------|--------|
| Vercel project | `cursor-central-vercel` (`prj_w49PjnyRV1vP2CJ88VDulB2JIXVi`) |
| Expected production SHA | `54e1d6a5b63e879c1800eb878c35c8a6ff86c5bb` (includes #137 + #138) |
| Route check | `/admin/golden-chain-operator` — HTTP **200** |
| Last-modified (CDN) | 2026-06-01 ~11:30 UTC (post-#138 deploy window) |
| Production URL | https://cursor-central-vercel.vercel.app |

Vercel MCP deployment list was not authorized in this agent session; SHA confirmed via `origin/main` and live route availability.

---

## 3. UAT order selection

| Requested | Actual |
|-----------|--------|
| **SO-2026-000117** | **Does not exist** (`order_number` query returns null; latest pilot seq remains **116**, already `dispatched`) |
| SKU **OAS-PUR-1** qty **2** | **Not creatable** in this session (see §8) |
| Substitute (cleanest pool) | **SO-2026-000026** (`198aff11-b3fd-497d-97a8-52d82fc96b99`) |
| Substitute (polluted) | SO-2026-000013 — 52+ readiness rows from prior 24B attempts |

**SO-2026-000026 profile (read-only):**

| Field | Value |
|--------|--------|
| `status` | `cleared_for_dispatch` |
| `payment_status` | `verified_advance` |
| `payment_cleared` | `false` |
| `advance_paid` | `29988` |
| `is_waste` | `false` |
| Lines | Mixed (`OAS-FIN-6000`, `OAS-CAS-TART-6000`) — **not** the requested OAS-PUR-1 × 2 spec |

Only two production orders match `cleared_for_dispatch` + `verified_advance`: **026** and **013**.

---

## 4. Wizard UAT execution (wizard UI only)

### Method

- Playwright on production (`desktop-chrome-size`), `ALLOW_FINANCE_E2E_MUTATIONS=true`.
- Roles: `dispatch@oasisbaklawa.com` (DISPATCH_HEAD); finance step not reached.
- Prep attempted: reservation board carton/gate scan buttons (post-#138).
- No SQL writes for governance; no legacy boards used for 4B–4G actions.

### Interaction metrics

| Metric | Value | Notes |
|--------|------:|-------|
| **Clicks** | **13** | Login, reservation board, wizard search/select, primary CTA |
| **Typing** | **104** | Credentials + search tail `000026` + scan barcode |
| **Page switches** | **5** | Login, reservation board, wizard (×2 navigations) |
| **Target (spec)** | 6–8 clicks, 0 typing | **Not achieved** |

### Search (PR #137)

| Test | Result |
|------|--------|
| Search `000026` on wizard | **PASS** — order appears in list (no PostgREST UUID error) |
| Search `000117` | **N/A** — order does not exist |

### Per-stage wizard results

| Stage | Primary CTA | Result | Notes |
|-------|-------------|--------|-------|
| **4B Readiness** | Complete readiness | **FAIL** (UI stuck) | CTA clicked; toast “completed”; stage **did not advance** to 4C |
| **4C Finance** | — | **Not reached** | Still on “Complete readiness” after dispatch session |
| **4D–4G** | — | **Not reached** | |
| **Complete** | — | **Not reached** | `orders.status` remains `cleared_for_dispatch` |

**Auto-refs:** Wizard auto-seeded packing/document/gate **readiness evidence** refs on 4B click.  
**Duplicate 4E guard:** Not exercised (4E not reached).  
**Reservation fulfilled after 4G:** Not exercised.  
**Stock finalization order:** Not exercised.

### Latest 4B review outcome (evidence ref text)

```
Status: exception_blocked · Gate: blocked
Blockers: Carton barcode not verified; Reservation not ready (status: none);
Finance signal not ready: pending_review; Verified gate scan required;
Open exception: dispatch_reservation_not_ready;
Open exception: dispatch_finance_signal_blocked
```

### Pilot reference (SO-2026-000112, completed chain — read-only)

| Table | Count |
|--------|------:|
| `dispatch_readiness_evidence` | 9 |
| `finance_review_evidence` | 3 |
| `dispatch_completion_evidence` | 2 |
| `dispatch_release_lineage` | 1 |
| `inventory_reservations` | 1 |
| `stock_consumption_lineage` | 1 |
| `operational_scan_records` | 2 |

112 proves backend chain **can** complete when scans + finance + reservation preconditions exist; wizard did not replicate on 026.

---

## 5. Stage-by-stage SQL verification (SO-2026-000026)

Read-only, staff JWT (`dispatch@oasisbaklawa.com`). Counts after wizard attempt:

| Stage | `dispatch_readiness_evidence` | `finance_review_evidence` | `dispatch_completion_evidence` | `dispatch_release_lineage` | `inventory_reservations` | `stock_consumption_lineage` | `operational_scan_records` | `orders.status` |
|-------|------------------------------:|--------------------------:|-------------------------------:|---------------------------:|-------------------------:|----------------------------:|---------------------------:|-----------------|
| Pre-UAT | 2 | 0 | 0 | 0 | 0 | 0 | 0 | `cleared_for_dispatch` |
| Post 4B attempt | **6** | 0 | 0 | 0 | 0 | 0 | **0** | `cleared_for_dispatch` |
| 4C–4G | — | — | — | — | — | — | — | **Not run** |

`inventory_movements`: no `order_id` column — join via `reservation_id` when reservations exist; **none** for this order.

---

## 6. Defects

| ID | Sev | Summary |
|----|-----|---------|
| **DEF-24C-01** | **P0** | **Cannot create SO-2026-000117** — buyer catalogue flow fails (`Shop by Category` not reachable for test buyer after login; no SO created). |
| **DEF-24C-02** | **P0** | **Scan prerequisites not reachable for `cleared_for_dispatch` orders** — `loadDispatchedOrdersForReservationBoard` filters `status = dispatched` only; SO-026/013 never appear in reservation board selector; `operational_scan_records` stay **0** after “prep” clicks. |
| **DEF-24C-03** | **P0** | **4B chicken-and-egg** — `deriveGoldenChainStage` requires `gate_eligible` (scans + finance commercially released + reservation ready) **before** 4C/4F; wizard 4B cannot advance on greenfield cleared orders without upstream scans/finance/reservation. |
| **DEF-24C-04** | **P1** | **4B false progress** — wizard writes readiness evidence and shows success toast but CTA remains “Complete readiness” (`exception_blocked`). |
| **DEF-24C-05** | **P1** | **No clean OAS-PUR-1 × 2 order** at `cleared_for_dispatch` + `verified_advance` in production pool. |
| **DEF-24C-06** | **P2** | Security Gate (`/security-gate`) requires `GATE_SECURITY` / `SECURITY_CONTROL` — not validated for DISPATCH_HEAD in this run; documented path for `operational_scan_records` but not wizard-integrated. |

**PR #137 search fix:** **Resolved** — no UUID `ilike` regression observed.

---

## 7. Operator readiness verdict

| Question | Verdict |
|----------|---------|
| **Backend ready?** | **Yes** — governed tables and projections work on completed pilots (e.g. SO-112). |
| **Wizard ready?** | **No** — cannot complete 4B→4G on greenfield `cleared_for_dispatch` orders without external scan/finance/reservation prep that the wizard does not orchestrate and reservation board does not expose for this status. |
| **Operator pilot allowed?** | **No** — blocked at 4B; misleading success toast; scan staging path broken for target order status. |
| **Company rollout allowed?** | **No** — same blockers; no validated clean SO-117 happy path. |

---

## 8. Recommendations (out of scope for 24C code freeze)

1. **Reservation board:** Include `cleared_for_dispatch` (and/or wizard-selected order) in scan prerequisite UI, or add scan capture to the wizard before 4B review.
2. **Stage ordering:** Allow finance commercial release (4C) and/or reservation (4F) before readiness gate when payment is `verified_advance` and order is cleared — or document mandatory Security Gate + Accounts Release sequence outside wizard.
3. **Buyer / admin order intake:** Restore buyer catalogue access for UAT account or provide dispatch-safe draft order path that does not require `b2b.oasisbaklawa.com`.
4. **4B UX:** Surface `exception_blocked` blockers in sticky CTA disabled state; do not toast success when `readinessStatus !== gate_eligible`.

---

## 9. Artifacts

| Artifact | Location |
|----------|----------|
| Phase 24B report | `docs/PHASE_24B_WIZARD_UAT_REPORT.md` |
| Playwright harness (full greenfield — buyer step fails) | `tests/phase-24c-clean-wizard-uat.spec.ts` |
| Wizard-only run metrics | Playwright log `[PHASE24C_WIZARD_METRICS]` (SO-026, 2026-06-01) |

---

**PHASE 24C FINAL:** Search/deploy **PASS**; clean greenfield wizard E2E **FAIL** at **4B**; operator pilot and company rollout **NOT ALLOWED**.
