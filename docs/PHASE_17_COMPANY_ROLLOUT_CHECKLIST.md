# PHASE 17 — Company rollout checklist

**Use after:** Production DDL applied, reprobe PASS, 5-order pilot PASS.  
**Production:** `tcxvcatsqqertcnycuop`  
**Not for:** Staging sign-off.

---

## Section 1 — Production deployment

| # | Task | Owner | Date | Pass |
|---|------|-------|------|------|
| 1.1 | Change ticket approved | Ops | | ☐ |
| 1.2 | DB backup / PITR confirmed | DBA | | ☐ |
| 1.3 | `migration list --linked` archived (pre) | Eng | | ☐ |
| 1.4 | Pre-deploy `orders` + `order_status_history` counts saved | Eng | | ☐ |
| 1.5 | `npx supabase db push` completed (19 migrations) | DBA/Eng | | ☐ |
| 1.6 | `migration list --linked` archived (post) — 19 new rows | Eng | | ☐ |
| 1.7 | No concurrent schema jobs during window | DBA | | ☐ |
| 1.8 | Vercel production SHA = `189177df` (or documented newer) | Eng | | ☐ |
| 1.9 | Env: `VITE_EXECUTION_PREVIEW_FALLBACK=false` | Eng | | ☐ |
| 1.10 | Env: `VITE_STOCK_FINALIZATION_DEMO=false` | Eng | | ☐ |

---

## Section 2 — Reprobe (read-only)

| # | Gate | Pass |
|---|------|------|
| 2.1 | G1 — Nine pilot tables exist | ☐ |
| 2.2 | G2 — Five supporting tables exist | ☐ |
| 2.3 | G3 — Migration versions `20260525230000`–`20260526160000` | ☐ |
| 2.4 | G4 — Eight immutable functions present | ☐ |
| 2.5 | G5 — RLS enabled + policy counts OK | ☐ |
| 2.6 | G6 — CHECK includes `dispatch_consumption_confirmed`, `consumption_finalized` | ☐ |
| 2.7 | G7 — `is_internal_staff`, `get_user_role` present | ☐ |
| 2.8 | G8 — Legacy table row counts unchanged | ☐ |
| 2.9 | UI smoke: 4B–4G boards load without persistence error | Eng | ☐ |

*SQL:* `docs/PHASE_15_5_PRODUCTION_REPROBE.md`

---

## Section 3 — Five-order pilot

| # | Task | Pass |
|---|------|------|
| 3.1 | Pre-pilot A1–A8 (`PRODUCTION_PILOT_CHECKLIST.md`) | ☐ |
| 3.2 | Five orders registered in `PILOT_ORDER_TEST_MATRIX.md` | ☐ |
| 3.3 | Order 1: 4B→4C→4D→4E→4F→4G complete | ☐ |
| 3.4 | Order 2: golden chain complete | ☐ |
| 3.5 | Order 3: golden chain complete | ☐ |
| 3.6 | Order 4: golden chain complete | ☐ |
| 3.7 | Order 5: golden chain complete | ☐ |
| 3.8 | Post-pilot SQL per order (checklist §C) | ☐ |
| 3.9 | E1: One `consumption_finalized` per consumed line | ☐ |
| 3.10 | E2: No orphan `pending` reservations after failed reserve | ☐ |
| 3.11 | E3: Finance + dispatch evidence present per order | ☐ |
| 3.12 | E4: Anomalies documented (reservation vs lineage) | ☐ |
| 3.13 | No pilot halt triggers fired | ☐ |

---

## Section 4 — Operator training

| # | Topic | Audience | Done |
|---|-------|----------|------|
| 4.1 | Golden chain order: 4B → 4C → 4D → 4E → 4F → 4G | Dispatch, finance, inventory | ☐ |
| 4.2 | **Only** `/admin/dispatch-finalization` sets `dispatched` | All ops | ☐ |
| 4.3 | Do not use `/admin/finance-board` or `/admin/finance` for pilot orders | Finance | ☐ |
| 4.4 | Stock finalization: SUPER_ADMIN override reason required | Admins | ☐ |
| 4.5 | Reservation board: wait for context match before Create & reserve | Inventory | ☐ |
| 4.6 | Trust `stock_consumption_lineage` over reservation row after 4G | Inventory | ☐ |
| 4.7 | Legacy boards: packing/accounts/order-mgmt rules (B routes) | Ops leads | ☐ |
| 4.8 | Halt criteria: duplicate lineage, wrong status, persistence errors | All | ☐ |
| 4.9 | Read-only SQL templates — no manual governance INSERT | Eng liaison | ☐ |
| 4.10 | `PHASE_17_LEGACY_WRITE_LOCKDOWN.md` briefed | Supervisors | ☐ |

---

## Section 5 — Store rollout (limited)

**Scope:** Ready goods / third-party / store coordination — **after** 5-order pilot PASS.

| # | Task | Pass |
|---|------|------|
| 5.1 | Store leads acknowledge `factory_inventory` ≠ governed balances for pilot SKUs | ☐ |
| 5.2 | No store coordination backend bookings on production (read-only shell) | ☐ |
| 5.3 | Ready goods: no `packed_ready` status jumps on pilot orders | ☐ |
| 5.4 | Security gate: carton scan only — not order closure | ☐ |
| 5.5 | Expand pilot 5 → 10 orders (optional) per matrix | ☐ |
| 5.6 | Second site / store group only after 10-order review | ☐ |

---

## Section 6 — Rollout sign-off

| Role | Name | Signature / date | GO / NO-GO |
|------|------|------------------|------------|
| Engineering lead | | | |
| DBA / platform | | | |
| Operations head | | | |
| Finance head | | | |
| Dispatch head | | | |

**GO criteria:** Sections 1–4 complete; Section 5 acknowledged for store staff; no open P0 blockers from `PHASE_17_REPORT.md`.

---

*End of company rollout checklist.*
