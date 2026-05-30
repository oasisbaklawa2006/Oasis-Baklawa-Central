# STAGE 14F IMPLEMENTATION REPORT — Reservation creation UI

**Date:** 2026-05-30  
**Staging:** `aruyieslaxjhnamlstpx` · **Production:** not touched  
**Branch:** `cursor/stage-14f-reservation-ui-a394`

---

## Summary

Governed **create + reserve** UI on `/admin/reservation-board` wires `createSupabaseReservationService` → `createReservation` / `reserveInventory`. Staging helpers record verified scans and open initial stock balances without bypassing 4G finalization rules.

**Verdict:** **READY FOR STAGE 14G STOCK FINALIZATION UI PROOF** (code + tests green; execute staging walkthrough below).

---

## Files changed

| File | Purpose |
|------|---------|
| `src/lib/inventory-reservations/buildAvailabilitySnapshot.ts` | Caller-provided availability snapshot from balances + open holds |
| `src/lib/inventory-reservations/reservationBoardQueries.ts` | Load dispatched orders, line items, balances, blockers |
| `src/lib/inventory-reservations/createGovernedReservation.ts` | `createAndReserveInventoryForOrder` service orchestration |
| `src/lib/inventory-reservations/reservationStagingPrerequisites.ts` | Governed scan + initial balance seed (explicit staging) |
| `src/lib/inventory-reservations/index.ts` | Export new modules |
| `src/components/admin/ReservationGovernancePanel.tsx` | Main 4F UI |
| `src/pages/admin/ReservationBoard.tsx` | Host panel + lifecycle reference (collapsed) |
| `src/lib/inventory-reservations/__tests__/buildAvailabilitySnapshot.test.ts` | Unit tests |
| `src/lib/inventory-reservations/__tests__/reservationBoardQueries.test.ts` | Blocker / label tests |
| `src/lib/inventory-reservations/__tests__/createGovernedReservation.test.ts` | In-memory create+reserve flow |

---

## UI route used

**`/admin/reservation-board`** — section **Governed reservation create (4F)**

1. Select dispatched order (label: `SO-2026-000002 · …1e85` or `Order 1e85`).
2. Select line / SKU from `order_items` → `products.sku`.
3. Set source location (default `WH-MAIN`) and reserve quantity.
4. Resolve **Reservation blockers** (dispatched status, availability, no duplicate active reserve).
5. If needed — **Staging prerequisites** (explicit):
   - **Record verified scan** → `operational_scan_records` (carton, verified).
   - **Open initial balance** → `inventory_stock_balances` insert via `upsertBalanceInitial`.
6. Click **Create & reserve** (auditable; uses correlation id `ui-4f-reservation-*`).
7. Continue on **`/admin/stock-finalization`** — **Finalize consumption** remains a separate explicit action.

---

## Services wired

| Service | Usage |
|---------|--------|
| `createSupabaseReservationService(supabase).getService()` | `createReservation`, `reserveInventory`, `listByOrder` |
| `createSupabaseScanRepository` | `recordVerifiedScanForStockFinalization` |
| `createSupabaseStockBalanceRepository` | `seedInitialStockBalance` → `upsertBalanceInitial` |

No direct `inventory_reservations` / `inventory_movements` inserts from UI components.

---

## Tables written (via governed paths only)

| Table | When |
|-------|------|
| `inventory_reservations` | `createReservation` + `reserveInventory` |
| `inventory_movements` | `reservation_created` (+ reserve transition movement) |
| `operational_events` | Reservation operational events (service) |
| `operational_scan_records` | Optional staging scan helper |
| `inventory_stock_balances` | Optional initial balance seed only |

**Not written by 4F:** `stock_consumption_lineage` (4G finalize only).

---

## Tests added

- `buildAvailabilitySnapshot.test.ts`
- `reservationBoardQueries.test.ts`
- `createGovernedReservation.test.ts`

**Commands (passing):**

```bash
npm run typecheck
npm run build
npm test -- --run src/lib/inventory-reservations
```

---

## Runbook — STAGE 14G UI proof (staging)

**Order:** SO-2026-000002 · `d6c79498-cde9-4394-b4d0-7b56d5371e85`  
**Admin:** staging credentials with `SUPER_ADMIN` / inventory module.

1. `/admin/reservation-board`
2. Select order **SO-2026-000002 · …1e85** (or fresh dispatched test order).
3. If blockers show missing scan → **Record verified scan** (e.g. `CTN-SO-2026-000002`).
4. If blockers show missing balance → **Open initial balance** (qty ≥ reserve qty).
5. **Create & reserve** → verify SQL:
   ```sql
   SELECT count(*) FROM inventory_reservations
   WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85';
   -- expect >= 1, status reserved
   ```
6. `/admin/stock-finalization` → order **…1e85** shows reservation linkage.
7. Click **Finalize consumption** (explicit) → verify:
   ```sql
   SELECT lineage_type FROM stock_consumption_lineage
   WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85';

   SELECT movement_type FROM inventory_movements
   WHERE correlation_id IN (
     SELECT correlation_id FROM stock_consumption_lineage
     WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85'
   );
   ```
8. Confirm `orders.status` remains **`dispatched`** (no silent status bypass).

---

## Safety

- No production project access.
- No migrations.
- No governance rule weakening.
- No auto stock finalization.
- No `stock_consumption_lineage` writes on reservation board.

---

## PR

Created from branch `cursor/stage-14f-reservation-ui-a394` (see GitHub PR link in agent summary).
