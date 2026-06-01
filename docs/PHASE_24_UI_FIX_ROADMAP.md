# PHASE 24 — UI Fix Roadmap

**Date:** 2026-06-01  
**Prerequisite docs:** `PHASE_24_HUMAN_EASE_UI_AUDIT.md`, `PHASE_24_OPERATOR_WORKFLOW_SCORECARD.md`, `PHASE_24_GOLDEN_CHAIN_OPERATOR_WIZARD_SPEC.md`  
**Implementation:** Not started in PHASE 24 (inspection only).

---

## Priority definitions

| Priority | Meaning | Target |
|----------|---------|--------|
| **P0** | Data integrity / wrong order / bypass governed chain | Before any staff rollout |
| **P1** | Major friction, training blockers, pilot anomalies | Before wide rollout |
| **P2** | Polish, mobile, nice-to-have automation | Post-rollout |

---

## P0 — Must ship before staff use

| # | Fix | Area |
|---|-----|------|
| 1 | Merge `/admin/golden-chain-operator` to `main` + deploy production | Wizard |
| 2 | Disable **Mark Dispatched** on Order Management when governed mode on | Legacy |
| 3 | Disable direct `dispatched` update in AdminPackingDispatch | Legacy |
| 4 | Idempotent **4E finalize** (client + DB constraint if available) | 4E |
| 5 | Stock finalization: bind **selected order**, never `liveRows[0]` | 4G |
| 6 | After 4G success, set reservation **fulfilled** (SO-112 fix) | 4G / 4F |
| 7 | Auto-generate packing/document/gate evidence refs in wizard | 4B |
| 8 | Inherit gate scan from `operational_scan_records` | 4B / 4G |
| 9 | Hide six-board routes from dispatch/inventory operator nav | Nav |
| 10 | Map all errors off “Unknown” to plain language | Global |
| 11 | Security gate: do not set order `dispatched` if governed finalize missing | Gate / 4E |
| 12 | Feature flag `VITE_GOLDEN_CHAIN_WIZARD_ENABLED` + env prod on | Deploy |

---

## P1 — High friction / pilot follow-ups

| # | Fix | Area |
|---|-----|------|
| 13 | Order cards show **SO-2026-NNNNNN**, not UUID tail | Boards |
| 14 | Single “who must act next” banner per order | Wizard |
| 15 | Auto-refresh boards after evidence write | 4B–4G |
| 16 | Remove or gate **preview/demo cards** when live empty | Boards |
| 17 | Finance-board: banner “For payment proof; dispatch approval is Finance Governance” | Nav |
| 18 | Reservation: default qty = line qty, location = WH-MAIN | 4F |
| 19 | Reservation: hide fulfilled orders from create list | 4F |
| 20 | Stock finalization: hide already-finalized orders | 4G |
| 21 | Collapse “lifecycle design reference” on reservation board | 4F |
| 22 | Replace `gate_eligible` badge with “Ready for gate scan” | 4B |
| 23 | Remove `dispatch_readiness_evidence` from operator-visible copy | 4B |
| 24 | Dispatch finalization: single “Lock dispatch” button; hide publish/reversal from operators | 4E |
| 25 | Loading state on all governance write buttons | Boards |
| 26 | Success toast includes next step URL (wizard deep link) | Boards |
| 27 | Role-filter wizard steps (finance vs stock vs dispatch) | Wizard |
| 28 | Sticky primary CTA on mobile (wizard) | Wizard |
| 29 | Reconcile **factory_inventory** label vs `inventory_stock_balances` | Inventory |
| 30 | AdminOperations: link to wizard for packed-ready orders | Ops |
| 31 | Packed-ready gate blockers link to wizard step | Orders |
| 32 | Audit log entry on wizard stage complete | Audit |
| 33 | Double-submit debounce on finalize (300ms + disabled) | 4E / wizard |
| 34 | Validate evidence ref matches scan before write | 4B |
| 35 | CMD war room: no dispatch status shortcuts | CMD |

---

## P2 — Polish & scale

| # | Fix | Area |
|---|-----|------|
| 36 | Camera capture for packing photo (replace AUTO-PACK ref) | 4B |
| 37 | QR scan on wizard for order lookup | Wizard |
| 38 | Recent orders tray on wizard home | Wizard |
| 39 | Print dispatch summary PDF | Wizard |
| 40 | WhatsApp notify on stage handoff | Notify |
| 41 | Tablet layout 2-column for supervisor | Wizard |
| 42 | Hindi copy for wizard strings | i18n |
| 43 | TV mode read-only chain status | TV |
| 44 | Batch queue: “next 5 orders ready for 4B” | Wizard |
| 45 | Analytics: avg clicks per stage | Metrics |
| 46 | Onboarding overlay for wizard only | Onboarding |
| 47 | Dark mode contrast on governance badges | a11y |
| 48 | Keyboard shortcuts for gate (Enter submit) | Gate |
| 49 | Deprecate six-board URLs (redirect to wizard) | Nav |
| 50 | Repair SO-2026-000112 reservation row (one-off script, non-UI) | Data |

---

## Top 50 UI fixes (consolidated list)

The numbered items **1–50** above are the canonical Top 50. Grouping:

- **Wizard & merge:** 1, 7, 8, 14, 27, 28, 36–38, 44, 46, 49  
- **Legacy lockdown:** 2, 3, 11, 9, 35  
- **4E / 4G integrity:** 4, 5, 6, 20, 33, 50  
- **Copy & clarity:** 10, 13, 22, 23, 26  
- **Boards cleanup:** 15–21, 24, 25  
- **Finance / ops / inventory:** 17, 29–31  
- **Mobile / a11y / i18n:** 28, 41–43, 47–48  
- **Notifications / print:** 39–40  

---

## Suggested implementation phases

### Phase 24A — Wizard merge + P0 (1–2 weeks engineering effort equivalent)

1. Merge `cursor/golden-chain-operator-wizard-3acf`  
2. Implement P0 #2–12  
3. UAT: one new pilot order 117 on production UI only (no SQL)

### Phase 24B — P1 friction

4. Items 13–35  
5. UAT: replay 112–116 read-only; fix 112 reservation via approved script

### Phase 24C — P2 polish

6. Items 36–50 as capacity allows

---

## Success metrics

| Metric | Baseline (six-board) | Target (wizard) |
|--------|----------------------|-----------------|
| Page switches per order | 6 | 0–1 |
| Clicks 4B→4G | 45–78 | 6–8 |
| Typed fields | 6–9 | 0 |
| SQL fallbacks in pilot | 2/5 orders full SQL | 0 |
| Duplicate finalize rate | 1/5 orders | 0 |
| Wrong-order 4G rate | 1/5 observed | 0 |
| Rollout readiness score | 31 | ≥85 |

---

## Dependencies

| Dependency | Owner |
|------------|-------|
| Merge wizard PR | Engineering |
| Production deploy from `main` | DevOps / Vercel |
| Role matrix in `AdminLayout` | Engineering |
| Optional DB unique index on finalize per order | DBA (if allowed post-PHASE 24) |
| Staff training sheet (1 page) | Operations |

---

## Final rollout verdict (roadmap)

| Gate | Status |
|------|--------|
| Backend ready | ✅ Pass |
| P0 complete | ❌ Not started |
| Operator UI ready | ❌ Blocked on P0 |
| Company rollout | ❌ After 24A UAT pass |

**Do not enable company-wide governed dispatch UI until P0 items 1–12 are deployed and UAT order passes without SQL.**

---

*End of PHASE 24 UI Fix Roadmap.*
