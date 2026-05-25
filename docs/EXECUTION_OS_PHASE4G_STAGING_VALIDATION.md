# Phase 4G — Physical Stock Finalization — Staging Validation

**Branch:** `cursor/phase-4g-stock-finalization-c4ef`  
**Depends on:** Phase 4A (reservations + movements), 4E (`dispatch_finalized`), 4F (no legacy dispatch bypass)  
**Migration:** `supabase/migrations/20260526160000_execution_os_phase4g_stock_finalization.sql`

---

## Prerequisites

| Gate | Proof |
|------|--------|
| PR #105–#120 stack merged or applied on staging | `dispatch_release_lineage`, `inventory_reservations`, legacy guard active |
| Phase 4E validated | Order reaches `dispatched` only via `supabaseDispatchFinalizationStore` |
| Phase 4F validated | No UI path sets `orders.status = dispatched` outside 4E |
| Phase 4A validated | Reservations persisted; `inventory_movements` append-only triggers active |

---

## 1. dispatch_finalized prerequisite

1. Finalize a test order on `/admin/dispatch-finalization` (governed path).
2. Confirm `orders.status = dispatched` and release projection `dispatch_finalized`.
3. Open `/admin/stock-finalization` — order appears in **Dispatch finalized (ready)** sample or production query.

**Pass:** Stock finalization projection shows `ready_for_consumption` only after step 1–2.

---

## 2. Stock deduction blocked before finalization

1. Select pre-finalization sample (or order still `cleared_for_dispatch`).
2. Attempt **Finalize consumption**.

**Pass:** Button disabled; blockers include `dispatch_not_finalized`. No `inventory_stock_balances` version bump.

---

## 3. Successful consumption finalization

1. Ensure reservation `reserved` or `fulfilled` with qty > 0 and scan reference.
2. Run **Finalize consumption** as `INVENTORY_MANAGER`.
3. Verify:
   - `inventory_movements.movement_type = dispatch_consumption_confirmed`
   - `stock_consumption_lineage.lineage_type = consumption_finalized`
   - `available_qty` decreased; `reserved_qty` decreased (optimistic `version` +1)

---

## 4. No negative stock

1. Set balance `available_qty` below consumable qty.
2. Attempt finalize.

**Pass:** `stock_variance_detected` internal event; finalize rejected (`negative_stock`). No silent adjustment.

---

## 5. Stale version

1. Finalize once (version → 2).
2. Retry finalize with `expectedBalanceVersion: 1`.

**Pass:** `stale_version` error; no double deduction.

---

## 6. Reservation reconciliation

1. Order with mixed reservation states (one `reserved`, one `pending`).
2. Review reconciliation panel.

**Pass:** `blockers` for pending; `consumed_qty` sums only consumable lines; no silent qty patch.

---

## 7. Reversal compensating event

1. After successful finalize, run reversal with typed `reversalReason` as `INVENTORY_MANAGER`.
2. Verify `dispatch_consumption_reversed` movement + `consumption_reversed` lineage.

**Pass:** `available_qty` restored; compensating metadata on movement.

---

## 8. Ledger immutability

```sql
-- Must fail
UPDATE inventory_movements SET quantity = 0 WHERE id = '<id>';
DELETE FROM inventory_movements WHERE id = '<id>';
UPDATE stock_consumption_lineage SET consumed_qty = 0 WHERE id = '<id>';
```

**Pass:** Triggers raise append-only exceptions.

---

## 9. Authority denial

| Role | Action | Expected |
|------|--------|----------|
| FINANCE_HEAD | finalize_consumption | Denied |
| OPS | finalize_consumption | Denied |
| INVENTORY_MANAGER | finalize_consumption | Allowed |
| Any | stock:silent_deduct | Forbidden |

---

## 10. No finance / payment / notification

Grep staging bundle (see PR grep table):

- No `capturePayment`, `generateInvoice`, `sendNotification`, `whatsapp`, `sms` in `src/lib/stock-finalization/` or `StockFinalizationBoard.tsx`.

---

## 11. Route / module gating

- `/admin/stock-finalization` requires `inventory` module (internal staff).
- No customer/public RLS on `inventory_stock_balances`.

---

## Sign-off

| Check | Owner | Date |
|-------|-------|------|
| Staging migration applied | | |
| End-to-end finalize + reversal | | |
| Bugbot / grep clean | | |
