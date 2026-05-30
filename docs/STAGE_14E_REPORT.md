# STAGE 14E REPORT — Stock reservation lifecycle + UI stock finalization

**Date:** 2026-05-30  
**Staging project:** `aruyieslaxjhnamlstpx` (production `tcxvcatsqqertcnycuop` not touched)  
**Order:** SO-2026-000002 · `d6c79498-cde9-4394-b4d0-7b56d5371e85` · status `dispatched`  
**Code baseline:** `main` (Execution OS governance UI merged)

---

## Summary

| Field | Value |
|--------|--------|
| **Reservation path found** | **No** (service exists; no UI wiring) |
| **UI/service used** | None — stopped at first blocker |
| **Reservation result** | Not created (`inventory_reservations` = 0) |
| **Stock finalization UI result** | Not executed (prerequisite: reservations) |
| **Stock Finalization** | **FAIL** |
| **Production pilot** | **NOT READY** |

---

## 1. Intended UI/service path for `inventory_reservations`

### Service layer (implemented)

| Layer | Path |
|--------|------|
| Service API | `src/lib/inventory-reservations/reservationService.ts` — `createReservation`, `reserveInventory`, lifecycle transitions |
| Supabase bundle | `src/lib/inventory-reservations/supabaseReservationRepository.ts` — `createSupabaseReservationService()` |
| Persistence | `src/lib/inventory-reservations/supabaseInventoryReservationStore.ts` — inserts `inventory_reservations`, allocations, append-only `inventory_movements` |

### UI surfaces (not implemented for writes)

| Route | Component | Behavior |
|--------|-----------|----------|
| `/admin/reservation-board` | `ReservationBoard.tsx` | **Design-only.** Copy: *"States below are design references only — no persisted reservation locks."* No calls to `createReservation` / `reserveInventory`. |
| `/admin/store-coordination` | `StoreCoordination.tsx` | **Local drafts only** (`saveReservationDraftLocal`). Explicit: no DB write. |
| `/admin/stock-finalization` | `StockFinalizationBoard.tsx` | **Reads** `inventory_reservations` via `loadStockFinalizationRows`; **consumes** reservations via `finalizeConsumption` — does not create them. |

**Grep proof:** `createReservation(` and `createSupabaseReservationService` appear only under `src/lib/inventory-reservations/__tests__/` — zero page/component imports.

**Documented intent:** `docs/EXECUTION_OS_PHASE4A_INVENTORY_RESERVATION.md` — engine + repository; UI deferred.

---

## 2. Can a reservation be created for SO-2026-000002 through UI only?

**No.** There is no admin screen that invokes the governed reservation service against Supabase for a dispatched order (or any order).

Attempting the golden chain at 4G without a prior reservation step is expected to fail; 4B–4E governance boards do not persist `inventory_reservations`.

---

## 3. Tasks 3–4 (blocked)

Per instructions: **stop at first blocker** — do not manually insert `inventory_reservations`, `stock_consumption_lineage`, or `inventory_movements`.

| Step | Status |
|------|--------|
| Create reservation through UI/service | **Skipped** — no UI path |
| Verify `inventory_reservations` ≥ 1 | **0** |
| Finalize on `/admin/stock-finalization` | **Skipped** |
| Verify lineage / movements for order | **0** rows |

---

## SQL verification (read-only, staging REST as internal admin)

**Project:** `aruyieslaxjhnamlstpx` only.

```sql
-- reservations
SELECT count(*) AS reservations
FROM inventory_reservations
WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85';
-- Result: 0

SELECT lineage_type
FROM stock_consumption_lineage
WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85';
-- Result: (empty)

SELECT movement_type
FROM inventory_movements
WHERE correlation_id IN (
  SELECT correlation_id
  FROM stock_consumption_lineage
  WHERE order_id = 'd6c79498-cde9-4394-b4d0-7b56d5371e85'
);
-- Result: (empty — no lineage rows for this order)
```

**Related staging state (same order):**

| Check | Value |
|--------|--------|
| `orders.status` | `dispatched` |
| `orders.order_number` | SO-2026-000002 |
| `dispatch_release_lineage` | 1 row (`finalize` → `dispatched`) |
| `operational_scan_records` | **0 rows** (would block 4G `scanReference` even after reservations) |
| `inventory_stock_balances` (product `36e01155-…`) | **0 rows** (would block consumption write) |

Note: Governance boards label this order as **Order 1e85** (last 4 of UUID), not by SO number.

---

## Blockers

1. **Primary (14E stop):** No UI/service surface wired to `createSupabaseReservationService` → `createReservation` / `reserveInventory`. Reservation board is a lifecycle reference mock only.
2. **Downstream (14G, if reservations existed):** `operational_scan_records` empty → `scanReference missing` on stock finalization board (`governanceReadQueries.ts`).
3. **Downstream:** No `inventory_stock_balances` for order product on staging.

---

## Code changes

**None.** Gap is missing product surface (Stage 14F), not a one-line UI bug on an existing create flow.

---

## Recommended Stage 14F implementation scope

1. **Reservation governance UI** on `/admin/reservation-board` (or order-scoped panel):
   - Load dispatched / cleared orders needing stock lock (or link from order detail).
   - Call `createSupabaseReservationService(supabase)` → `createReservation` + `reserveInventory` with caller-supplied `InventoryAvailabilitySnapshot` (per `RESERVATION_AVAILABILITY_SOURCES_PENDING` docs).
   - Show reservation number, status, version; surface `stale_version` conflicts.
2. **Wire availability read** from `inventory_stock_balances` (and future physical/blocked sources) before `reserveInventory`.
3. **Optional:** Seed or govern `operational_scan_records` during 4B/4E so 4G `scanReference` is satisfied without SQL hacks.
4. **Ensure** `inventory_stock_balances` exists for golden-chain SKUs on staging before 4G finalize.
5. **Tests:** Playwright path — create reservation → stock finalization → assert lineage + movements (staging project only).

---

## Verdict

| Item | Result |
|------|--------|
| **Stock Finalization** | **FAIL** |
| **READY FOR PRODUCTION PILOT** | **NOT READY** |

Golden chain 4B–4E remains valid for governance evidence; **4G cannot be validated UI-only until 14F delivers reservation creation UI wired to the Phase 4A service.**
