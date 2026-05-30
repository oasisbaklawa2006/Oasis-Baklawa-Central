# Production pilot checklist — governed execution chain (5–10 orders)

**Scope:** Controlled production pilot on project `tcxvcatsqqertcnycuop` (production only when explicitly authorized).  
**Code baseline:** `main` including PR #129 (4F reservation UI), PR #131 (4F.1 Bugbot), PR #132 (4G SUPER_ADMIN override + compensation).  
**Do not use this checklist on staging** for production sign-off; use it when production tables and RLS are confirmed live.

---

## A. Pre-pilot gates (once per environment)

| # | Check | Owner | Pass |
|---|--------|-------|------|
| A1 | Phase 4A–4G migrations applied on **production** (read-only probe: `inventory_reservations`, `inventory_stock_balances`, `stock_consumption_lineage`, `dispatch_release_lineage`, `operational_scan_records`) | Eng | ☐ |
| A2 | `VITE_EXECUTION_PREVIEW_FALLBACK=false` and `VITE_STOCK_FINALIZATION_DEMO=false` on production build | Eng | ☐ |
| A3 | Pilot operators have known roles: `DISPATCH_HEAD` / `FINANCE_HEAD` / `INVENTORY_MANAGER` and at most one `SUPER_ADMIN` with written override policy | Ops | ☐ |
| A4 | `SUPER_ADMIN` stock finalization policy: typed **override reason** required (PR #132) — document allowed phrases | Ops | ☐ |
| A5 | Legacy dispatch paths decommissioned for pilot cohort: no direct `orders.status → dispatched` outside `/admin/dispatch-finalization` | Eng | ☐ |
| A6 | Pilot order IDs recorded in `PILOT_ORDER_TEST_MATRIX.md` before any mutations | Ops | ☐ |
| A7 | Read-only SQL templates prepared (no manual INSERT to governance tables) | Eng | ☐ |
| A8 | Rollback / stop criteria agreed: halt pilot if any order gets duplicate `consumption_finalized` lineage or unexpected `orders.status` change | Ops + Eng | ☐ |

---

## B. Per-order golden chain (UI only)

Execute in order. **Do not skip steps.** **Do not run SQL writes.**

| Step | Route | Action | Stop if |
|------|-------|--------|---------|
| **4B** | `/admin/dispatch-readiness` | Record packing photo, document placeholder, gate scan; **Record readiness review** | Gate not eligible |
| **4C** | `/admin/finance-governance` | **Start finance review** → **Record commercial release** when eligible | Commercial release blocked |
| **4D** | `/admin/dispatch-completion` | **Review completion** → **Attest completion** | Attestation blocked |
| **4E** | `/admin/dispatch-finalization` | Confirm handoff refs; **Finalize dispatch (governed)** | Only path to `orders.status = dispatched` |
| **4F** | `/admin/reservation-board` | Select dispatched order + line; resolve scan/balance blockers via explicit staging buttons if needed; **Create & reserve** | Wait until context matches selection (no stale context) |
| **4G** | `/admin/stock-finalization` | Enter **override reason** if `SUPER_ADMIN`; **Finalize consumption** | Blockers or authority message |

**Between steps:** dismiss onboarding overlays; confirm live signals banner (not preview cards).

---

## C. Per-order verification (read-only SQL)

Replace `:order_id` with pilot UUID.

```sql
-- Order must remain dispatched after 4G (unless separate business process changes it)
SELECT id, status FROM orders WHERE id = :order_id;

SELECT reservation_number, reservation_status, reserved_qty, fulfilled_qty
FROM inventory_reservations WHERE order_id = :order_id;

SELECT lineage_type, consumed_qty, reason_code, correlation_id
FROM stock_consumption_lineage WHERE order_id = :order_id;

SELECT movement_type, quantity, reason_code, correlation_id
FROM inventory_movements
WHERE correlation_id IN (
  SELECT correlation_id FROM stock_consumption_lineage WHERE order_id = :order_id
);

SELECT sku, location_code, available_qty, reserved_qty, version
FROM inventory_stock_balances
WHERE sku = :pilot_sku AND location_code = :location;
```

| Expectation | After 4F | After 4G |
|-------------|----------|----------|
| `orders.status` | `dispatched` | `dispatched` |
| `inventory_reservations` | ≥1 row, `reserved` (typical) | Row may still show `reserved` / `fulfilled_qty=0` — **lineage is source of truth for consumption** |
| `stock_consumption_lineage` | 0 | ≥1 `consumption_finalized` |
| `inventory_movements` | reservation movements | includes `dispatch_consumption_confirmed` |
| `inventory_stock_balances` | row exists if seeded | `available_qty` decreased; `version` incremented |

---

## D. Pilot safety rules

- **No** manual INSERT/UPDATE on `inventory_reservations`, `stock_consumption_lineage`, `inventory_movements`, or `dispatch_release_lineage`.
- **No** stock finalization for orders not in the pilot matrix.
- **No** using staging project credentials on production (or vice versa).
- **No** `VITE_STOCK_FINALIZATION_DEMO=true` in production.
- If **Create & reserve** fails after partial create, verify compensation cancelled orphan reservation before retry.
- If **Finalize consumption** fails with stale balance version, refresh board and retry once; do not force-update balances.

---

## E. Post-pilot review (after 5–10 orders)

| # | Review item | Pass |
|---|-------------|------|
| E1 | All pilot orders: exactly one `consumption_finalized` lineage per reservation line consumed | ☐ |
| E2 | No pilot order left in `pending` reservation after failed reserve without cancel | ☐ |
| E3 | Finance / dispatch evidence rows present for each order | ☐ |
| E4 | Document anomalies (reservation status vs lineage, balance `reserved_qty` vs reservation row) | ☐ |
| E5 | Update `PHASE_15_PRODUCTION_PILOT_REPORT.md` with outcomes | ☐ |

---

## F. Escalation

| Symptom | Action |
|---------|--------|
| `SUPER_ADMIN requires typed overrideReason` | Enter override on stock board (PR #132) |
| `Stale balance version` | Reload stock board; confirm `inventory_stock_balances.version` |
| `reservation_*_already_finalized` | Do not re-finalize; verify lineage |
| Unexpected `orders.status` | Compare `order_status_history` and `dispatch_release_lineage`; check legacy boards (see Phase 15 report) |
| Duplicate consumption lineage | **Stop pilot**; engineering review |
