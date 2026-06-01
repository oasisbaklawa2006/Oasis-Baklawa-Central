# PHASE 24 — Human-Ease UI Inspection Report

**Date:** 2026-06-01  
**Scope:** Operator productization audit for governed dispatch chain (4B→4G)  
**Production pilot reference:** SO-2026-000112 … SO-2026-000116 (`docs/PHASE_23B_PRODUCTION_PILOT_BLITZ_REPORT.md`)  
**Production URL:** https://cursor-central-vercel.vercel.app  
**Supabase project:** `tcxvcatsqqertcnycuop`  
**Rules:** Inspection only — no schema changes, no migrations, no production writes, no implementation in this phase.

---

## Executive summary

| Question | Verdict |
|----------|---------|
| **Backend / data plane ready?** | **Yes** — append-only evidence, finalize lineage, reservations, consumption, and stock decrement work when driven correctly (pilot proved with SQL fallback). |
| **Admin / audit UI ready?** | **Partial** — audit trail, war room, finance release board, order trace exist; governed boards are engineer-oriented. |
| **Operator UI ready?** | **No** — six-board flow is fragmented, jargon-heavy, typing-heavy, and mistake-prone; pilot required SQL for blitz completion. |
| **Company rollout ready?** | **No** — staff must not run 4B→4G on current UI without PHASE 24 wizard + legacy path lockdown. |

**Target operator experience (not met today):** Select order → see one next task → one primary action → system advances. **0–1 page switches**, **0 typing** on happy path, **6–8 clicks** for full 4B→4G.

**Critical repo/deploy note:** Governed boards exist on **`origin/main`** (`dispatch-readiness`, `finance-governance`, `dispatch-completion`, `dispatch-finalization`, `reservation-board`, `stock-finalization`). The **Golden Chain Operator wizard** (`/admin/golden-chain-operator`) exists only on branch `origin/cursor/golden-chain-operator-wizard-3acf` — **not merged to main** at audit time. Some workspace checkouts (e.g. Sprint B branches) **omit** governance routes entirely; production may lag `main` depending on deploy.

---

## A. Complete route / page inventory

### A.1 Governed golden chain (production `main` — Phase 4 UI)

| Route | Component | Primary actor | Purpose |
|-------|-----------|---------------|---------|
| `/admin/dispatch-readiness` | `DispatchReadinessBoard` | Dispatch / packing | 4B evidence + readiness review |
| `/admin/finance-governance` | `FinanceGovernanceBoard` | Finance | 4C commercial release |
| `/admin/dispatch-completion` | `DispatchCompletionBoard` | Dispatch supervisor | 4D completion attestation |
| `/admin/dispatch-finalization` | `DispatchFinalizationBoard` | Dispatch / ops | 4E governed finalize (lineage) |
| `/admin/reservation-board` | `ReservationBoard` + `ReservationGovernancePanel` | Store / inventory | 4F reservation create |
| `/admin/stock-finalization` | `StockFinalizationBoard` | Store / inventory | 4G consumption + balance |

### A.2 Proposed operator wizard (not on `main`)

| Route | Component | Status |
|-------|-----------|--------|
| `/admin/golden-chain-operator` | `GoldenChainOperatorWizard` | Branch `cursor/golden-chain-operator-wizard-3acf` only |

### A.3 Legacy / parallel paths (still in `App.tsx` on most branches)

| Route | Component | Conflicts with 4B→4G |
|-------|-----------|----------------------|
| `/admin/order-management` | `OrderManagement` | **Yes** — linear status buttons include **Mark Dispatched** without evidence chain |
| `/admin/packing-dispatch` | `AdminPackingDispatch` | **Yes** — finance clear + dispatch modal, transporter fields, direct `dispatched` |
| `/admin/dispatch-mgmt` | `DispatchManagement` | **Yes** — scan/pack legacy queue |
| `/admin/finance-board` | `FinanceReleaseBoard` | **Partial** — payment verification, not `finance_review_evidence` |
| `/admin/accounts-release` | `AdminAccountsRelease` | Partial — accounts workflow |
| `/admin/operations` | `AdminOperations` | Low — production routing (Sprint B improved empty states) |
| `/admin/orders` | `AdminOrders` | Partial — packed-ready gate display |
| `/security-gate` | `AdminSecurityGate` | **Yes** — carton scan can set `physically_dispatched` / order `dispatched` outside lineage |
| `/admin/inventory` | `AdminInventory` | **Yes** — `factory_inventory` vs `inventory_stock_balances` |
| `/admin/ready-goods` | `ReadyGoodsStore` | Parallel store flow |
| `/admin/cmd-war-room` | `CMDWarRoom` | CMD only — not operator chain |

### A.4 TV / display / buyer (out of golden chain scope)

`/admin/dispatch-tv`, `/tv/*`, buyer portal, public tracking — not audited for 4B→4G except as distraction risk in nav.

---

## B. Human-ease score per page (summary)

Full numeric breakdown: `docs/PHASE_24_OPERATOR_WORKFLOW_SCORECARD.md`.

| Module | Human clarity | Rollout readiness |
|--------|---------------|-------------------|
| Dispatch readiness | 42 | 35 |
| Finance governance | 48 | 40 |
| Dispatch completion | 45 | 38 |
| Dispatch finalization | 40 | 32 |
| Reservation board | 38 | 30 |
| Stock finalization | 35 | 28 |
| Security gate | 55 | 50 (gate only, not chain) |
| Order management | 50 | **20** (dangerous bypass) |
| Packing-dispatch | 52 | **25** (dangerous bypass) |
| Finance release board | 58 | 45 (wrong stage for 4C) |
| Golden chain wizard (branch) | 72 | 55 (needs merge + hardening) |

---

## C. Click-count per workflow (six-board path, one order)

Estimates from component structure + PHASE 23B pilot behavior. “Refresh” = manual navigation back or waiting for realtime.

| Flow | Page switches | Clicks (typical) | Clicks (rushed/stressed) | Refreshes | Confirmations |
|------|---------------|------------------|--------------------------|-----------|---------------|
| **4B Dispatch readiness** | 1 | 12–18 | 20+ | 1–2 | 3 evidence submits + 1 review |
| **4C Finance release** | 1 | 4–8 | 10+ | 1 | 1 commercial release |
| **4D Dispatch completion** | 1 | 8–14 | 16+ | 1 | 2 attestation/evidence actions |
| **4E Dispatch finalization** | 1 | 5–10 | 12+ (double-submit risk) | 1 | 1 finalize (+ optional publish) |
| **4F Reservation** | 1 | 10–16 | 18+ | 1 | 1 create reservation |
| **4G Stock finalization** | 1 | 6–12 | 14+ | 1–2 | 1 finalize (+ override dialog) |
| **Security gate scan** | 1 (parallel) | 2–4 | 6+ | 0–1 | Scanner beep only |
| **Full 4B→4G (six boards)** | **6** | **45–78** | **90+** | **6+** | **8–12** |
| **Target (wizard)** | **0–1** | **6–8** | **≤10** | **0** (auto) | **1 per stage max** |

---

## D. Typing burden per workflow

| Field | Where | Required today? | Recommendation |
|-------|--------|-----------------|----------------|
| Packing photo reference | 4B evidence panel | Yes (manual) | Auto from media upload or `PHOTO-{SO}` |
| Document placeholder | 4B | Yes | Auto `DOC-{SO}` or invoice stub link |
| Gate scan reference | 4B | Often yes | Inherit from `operational_scan_records` / security gate |
| Transporter reference | 4E | Sometimes | Inherit gate scan + dispatch modal |
| Override reason | 4G SUPER_ADMIN | Yes when override | Keep for exceptions only |
| Reservation location | 4F | Default WH-MAIN | Dropdown, default site |
| Reserve quantity | 4F | Pre-filled but editable | Lock to order line qty |
| Scan barcode (4F staging) | 4F | Optional | Use carton scan from 4B |
| Correlation / evidence ref | Internal | Hidden from operators | System-generated only |
| Reject / exception reason | Finance / exceptions | Yes on reject | Keep |

**Six-board happy path typing today:** ~6–10 fields. **Target:** 0 (only override reason on exception).

---

## E. Automation opportunities (prioritized)

1. **Auto-generate evidence refs** — `packing_photo`, `document_placeholder`, `gate_scan` from SO + scan tables.
2. **Auto-detect current stage** — single order state machine (wizard branch already sketches this).
3. **Auto-detect next action + owner** — “Finance must release” / “Store must reserve”.
4. **Auto-refresh after write** — no manual reload; optimistic UI + refetch.
5. **Auto-skip completed stages** — collapse 4B–4F when evidence exists.
6. **Auto-hide finalized stock candidates** — fix 4G selector stuck on prior order (SO-114).
7. **Auto-mark reservation fulfilled after 4G** — fix SO-112 drift (`reserved` + consumption).
8. **Idempotent 4E finalize** — block duplicate lineage (SO-113 had 2 finalize rows).
9. **Auto-create reservation from order line** — product, qty, WH-MAIN.
10. **Auto-use dispatch lineage + scan refs in 4G** — no re-entry.
11. **Auto-pre-fill override** only when policy allows — not for floor staff.
12. **Hide legacy “Mark Dispatched”** when governed mode enabled.

---

## F. Confusing terminology list

| Term shown in UI | Operator interpretation risk | Plain-language replacement |
|------------------|------------------------------|----------------------------|
| gate_eligible | “Can leave gate?” | “Ready for security scan” |
| readinessStatus / dimension badges | Engineering checklist | “Packing checklist” with ✓/✗ |
| dispatch_readiness_evidence | Database table | “Packing proof recorded” |
| commercial_release | Legal jargon | “Finance approved dispatch” |
| dispatch_release_lineage | Unknown | “Dispatch locked in system” |
| finalize vs publish vs reversal | Three dangerous verbs | One “Complete dispatch” + supervisor “Undo” |
| inventory_reservations | ERP speak | “Stock held for this order” |
| stock_consumption_lineage | Audit speak | “Stock deducted” |
| correlationId | DevOps | Hidden |
| persistenceMode / demo | Deploy concepts | Hidden; show “Connected” / “Offline” |
| Phase 4B / 4C / 4D labels in links | Sprint language | “Step 2 of 6: Finance” |
| governed-only | Policy | “Official process” |
| Unknown (company on gate) | Broken | “Company not found — call supervisor” |
| factory_inventory vs stock balances | Two truths | Single “Available stock” |

---

## G. Dangerous / misleading UI list

| Issue | Severity | Evidence |
|-------|----------|----------|
| Order Management **Mark Dispatched** bypasses 4B–4G | **P0** | `STATUS_FLOW` includes `cleared_for_dispatch` → `dispatched` |
| Packing-dispatch dispatches without lineage | **P0** | `AdminPackingDispatch` updates `orders.status` directly |
| Security gate sets order `dispatched` on last carton | **P0** | `AdminSecurityGate` — parallel to 4E |
| Duplicate 4E finalize allowed | **P0** | SO-2026-000113 two finalize rows |
| Stock finalization selector stuck on wrong order | **P0** | SO-2026-000114; `activeRow = liveRows[0]` pattern |
| Reservation not fulfilled after 4G | **P1** | SO-2026-000112 data drift |
| Preview/demo cards on empty live data | **P1** | `showPreviewCards` on governance boards — looks real |
| Order cards show UUID tail (`…5c67`) not SO | **P1** | Readiness/finalization cards |
| Finance-board vs finance-governance | **P1** | Staff use wrong board for 4C |
| Silent failures / generic errors | **P1** | Pilot: “Unknown” on evidence writes |
| No success “what’s next” after stage | **P2** | Operator must know board sequence |
| SUPER_ADMIN override reason on 4G | **P2** | Correct for audit, wrong default for floor |

---

## H. Duplicate / legacy UI classification

| Page / route | Class | Operator guidance |
|--------------|-------|-------------------|
| `/admin/golden-chain-operator` (branch) | **D** (target primary) | Merge + harden; default for dispatch chain |
| `/admin/dispatch-readiness` … `stock-finalization` | **B** | Supervisor / break-glass only after wizard |
| `/admin/finance-board` | **B** | Payment verification; link to 4C when order cleared |
| `/admin/finance-governance` | **D** | 4C only — hide from non-finance |
| `/admin/order-management` status buttons (dispatch stages) | **A** for dispatch roles | Read-only or remove dispatch transitions |
| `/admin/packing-dispatch` dispatch tab | **A** | Packing only; remove dispatch confirm |
| `/admin/dispatch-mgmt` | **B** | Scan helper, not status authority |
| `/admin/inventory` (factory_inventory) | **C** | Read-only for operators; label “legacy stock view” |
| `/admin/stock-finalization` | **B** until wizard 4G stable | |
| `/admin/audit` | **C** | Supervisors / finance audit |
| `/admin/cmd-war-room` | **B** | CMD / SUPER_ADMIN only |

---

## I. Mobile / tablet usability findings

| Page | Phone | Tablet | Desktop | Notes |
|------|-------|--------|---------|-------|
| Dispatch readiness | 35 | 55 | 75 | Many badges, small text `text-[10px]`, multi-column cards |
| Finance governance | 40 | 60 | 80 | Dialogs OK; tables cramped |
| Dispatch completion | 35 | 55 | 75 | Similar to 4B |
| Dispatch finalization | 30 | 50 | 70 | Blocker lists long; small buttons |
| Reservation board | 30 | 55 | 78 | Multiple selects + numeric inputs |
| Stock finalization | 25 | 45 | 72 | Override field + toggle; high mis-tap risk |
| Security gate | **75** | **85** | 70 | Large scan feedback; best mobile page |
| Order management | 45 | 65 | 85 | Long lists; pipeline OK on tablet |
| Packing-dispatch modal | 40 | 60 | 80 | Many fields for transporter |

**Cross-cutting:** No sticky primary CTA on governance boards; accidental navigation via sidebar; `pb-24` suggests mobile intent but actions not thumb-sized.

---

## 1. Human understanding (dimension audit)

- **Non-technical comprehension:** Low on governance boards (expose table names, phase codes, persistence badges).
- **Next action clarity:** Low — six separate URLs; headers link to “4D” but not “do this now”.
- **Blocked explanation:** Medium — `GovernancePrerequisiteList` helps engineers; messages cite `dispatchLineageId`, `scanReference`.
- **Who must act next:** Not shown — no role-based “Waiting on Finance” banner.

---

## 2. Ease of application

- **Without engineering:** Failed for pilot blitz (SQL fallback for 115–116).
- **Rush hour:** Poor — high click count, easy to pick wrong order on 4G.
- **New employee in 30 minutes:** Unrealistic for six-board path; realistic for wizard after training + legacy hidden.
- **Supervisor verification:** Hard — must open 6 pages or SQL; no single order timeline for 4B–4G.

---

## 7. Error quality audit (samples)

| Bad (observed / likely) | Good (required copy) |
|-------------------------|----------------------|
| Unknown | “Could not save packing proof. Check internet and try again. If it repeats, note order SO-____ and call IT.” |
| (silent button) | Disable button + tooltip: “Finance has not approved this order yet.” |
| `dispatchLineageId missing` | “Dispatch is not locked in the system. Finish ‘Complete dispatch’ step first.” |
| `scanReference missing` | “No carton scan on file. Scan at Security Gate or enter carton barcode on Packing screen.” |
| Persistence unavailable | “Stock system is updating. Try again in 2 minutes or call supervisor.” |
| Invalid barcode | Already OK on gate — extend to 4B gate evidence auto-fill |

---

## 8. Operator role audit (what they should see)

| Role | Should see | Should NOT see |
|------|------------|----------------|
| Dispatch operator | Wizard, packing-dispatch (pack only), security gate, readiness (if wizard unavailable) | Finance governance, stock finalization, audit, CMD |
| Finance user | Finance governance / wizard finance step, finance-board payments | Stock finalization, dispatch finalization |
| Inventory / stock | Wizard 4F/4G, reservation panel | Finance governance, order status dispatch buttons |
| Supervisor | Wizard + read-only six-board + audit | CMD war room (unless dual role) |
| SUPER_ADMIN / CMD | All + override reason fields | — |
| Security gate | `/security-gate` only | Reservation, finance, lineage boards |
| Store / ready goods | Ready goods, wizard stock steps | Dispatch finalization |

`AdminLayout` `ROLE_MODULE_ACCESS` does **not** map governance routes per role on all branches — finance/dispatch/inventory see overlapping nav.

---

## 10. Staff training burden (by module)

| Module | Training estimate |
|--------|-------------------|
| Six-board 4B→4G | **1 hour + cheat sheet** (engineering-assisted) |
| Golden chain wizard (branch) | **10–15 minutes** after legacy hidden |
| Finance release board | 10 minutes (payments) |
| Order management dispatch buttons | **Mis-training risk** — should be **admin-only** |
| Security gate | 5 minutes |
| Stock finalization alone | 30 minutes (error messages technical) |

---

## 11. Mistake-risk audit

- Wrong order on 4G (first row default, not selected order).
- Double finalize 4E (no idempotency UI).
- Legacy dispatch while governed incomplete.
- Wrong SKU reservation if line not re-selected after order change.
- Double stock consumption if finalize clicked twice.
- Processing old order (no “completed orders hidden” filter).
- Typing wrong evidence ref (no validation against scans).

---

## 12–14. Wizard & desired experience

Detailed design: `docs/PHASE_24_GOLDEN_CHAIN_OPERATOR_WIZARD_SPEC.md`.

**Desired:** 0–1 pages, 0 typing, 6–8 clicks, mental model “select order → complete next step.”

---

## K. Top 50 UI fixes

See `docs/PHASE_24_UI_FIX_ROADMAP.md` (numbered list with P0/P1/P2).

---

## L. Golden Chain Operator Wizard

Spec document: `docs/PHASE_24_GOLDEN_CHAIN_OPERATOR_WIZARD_SPEC.md`. Implementation exists on branch `cursor/golden-chain-operator-wizard-3acf`; merge + pilot hardening required.

---

## M. Final rollout verdict

| Question | Answer |
|----------|--------|
| Backend ready? | **Yes** |
| Admin/audit UI ready? | **Partial** |
| Operator UI ready? | **No** |
| Company rollout ready? | **No** |
| What must be built before staff use? | Merge **Golden Chain Operator Wizard**, idempotent 4E, order-scoped 4G, auto evidence refs, reservation fulfill on 4G, **disable legacy dispatch paths**, role-filtered nav, human error copy |
| Final flow clicks? | **6–8** (wizard); today **45–78** (six boards) |
| Final flow typing? | **0** normal; override reason only on exception |
| Pages to hide from operators? | `order-management` dispatch actions, `packing-dispatch` dispatch confirm, six-board suite (post-wizard), `factory_inventory` write paths, CMD war room |

**PHASE 24 inspection conclusion:** The business can trust the **data plane**; it cannot yet trust the **operator plane**. Proceed to implementation sprint (wizard merge + legacy lockdown + P0 fixes) before floor rollout.

---

*End of PHASE 24 Human-Ease UI Audit.*
