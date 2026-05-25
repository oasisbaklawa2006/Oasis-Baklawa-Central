# Phase 4A / 4A.1 staging validation — Inventory reservation engine

## Migration

- [ ] Apply `20260526030000_execution_os_phase4a_inventory_reservation.sql`
- [ ] Verify `inventory_movements` UPDATE/DELETE raises exception
- [ ] Verify RLS: internal staff only

## Phase 4A.1 — SQL-backed reservation persistence adapter

Prerequisites: tables `inventory_reservations`, `inventory_reservation_allocations`, `inventory_movements` exist; append-only trigger on movements verified.

### SQL-backed reservation create proof

```sql
-- Staff session (internal role JWT)
INSERT INTO public.inventory_reservations (
  reservation_number, order_id, product_id, sku, requested_qty, correlation_id, version
) VALUES (
  'RES-STG-' || substr(gen_random_uuid()::text, 1, 8),
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000020',
  'SKU-STG-4A1',
  5,
  'corr-stg-create',
  1
)
RETURNING id, reservation_status, version;
```

- [ ] Row inserts as `pending`, `version = 1`
- [ ] App path: `createSupabaseInventoryReservationStore` → `createReservationRow` (no direct UI writes)

### Optimistic lock proof

```sql
-- Succeeds: id + version match
UPDATE public.inventory_reservations
SET reservation_status = 'reserved', reserved_qty = 5, version = 2, updated_at = now()
WHERE id = '<reservation_id>' AND version = 1
RETURNING id, version;

-- Stale: same expected version again
UPDATE public.inventory_reservations
SET reservation_status = 'cancelled', version = 2, updated_at = now()
WHERE id = '<reservation_id>' AND version = 1;
-- Expect 0 rows; app maps to stale_version
```

- [ ] First update returns one row, `version = 2`
- [ ] Second update with stale `version` affects 0 rows
- [ ] Application `updateReservationWithVersion` throws `ReservationError` code `stale_version`

### Stale version fail proof (race)

- [ ] Two concurrent reserve attempts with same `expectedVersion`; only one succeeds
- [ ] Loser receives `stale_version`, no blind overwrite

### Allocation insert proof

```sql
INSERT INTO public.inventory_reservation_allocations (
  reservation_id, inventory_entity_type, inventory_entity_id, allocated_qty, allocation_status
) VALUES (
  '<reservation_id>', 'logical_hold', gen_random_uuid(), 2, 'active'
)
RETURNING id, allocated_qty, allocation_status;
```

- [ ] Positive `allocated_qty` only
- [ ] Negative qty rejected by CHECK
- [ ] No `stock_items` / `inventory_stock` mutation

### Movement append proof

```sql
INSERT INTO public.inventory_movements (
  movement_type, reservation_id, product_id, sku, quantity, correlation_id
) VALUES (
  'inventory_hold', '<reservation_id>',
  '00000000-0000-4000-8000-000000000020', 'SKU-STG-4A1', 2, 'corr-stg-hold'
)
RETURNING id, movement_type;
```

- [ ] Insert succeeds for allowed types
- [ ] `deduct_stock` rejected by CHECK and by app `validateInventoryMovementInsert`

### Movement UPDATE / DELETE fail proof

```sql
UPDATE public.inventory_movements SET quantity = 0 WHERE id = '<movement_id>';
-- Expect: trigger/exception — ledger immutable

DELETE FROM public.inventory_movements WHERE id = '<movement_id>';
-- Expect: trigger/exception — ledger immutable
```

- [ ] Both fail in staging (append-only trigger `inventory_movements_immutable`)

### No stock table mutation proof

```sql
-- Before/after reservation flow — counts unchanged
SELECT count(*) FROM public.stock_items;
SELECT count(*) FROM public.inventory_stock;
```

- [ ] No writes to stock tables during reservation create/reserve/release
- [ ] Grep: no `deductStock`, `stock_items`, `inventory_stock` in reservation adapter path

### RLS staff / non-staff proof

- [ ] Authenticated internal staff: SELECT/INSERT on reservation tables per policy
- [ ] Anonymous or customer role: INSERT/UPDATE denied
- [ ] Service role used only from server/repository paths, not browser UI

### Availability snapshot (no silent stock read)

- [ ] `reserveInventory` requires caller-provided `InventoryAvailabilitySnapshot`
- [ ] `RESERVATION_AVAILABILITY_SOURCES_PENDING` documents pending Stock OS sources
- [ ] Adapter does not SELECT from `stock_items` or `inventory_stock`

## Reservation lifecycle

- [ ] Create reservation → `pending` + `reservation_created` movement + event
- [ ] Reserve full qty → `reserved` + `inventory_hold` movement
- [ ] Partial reserve → `partially_reserved`
- [ ] Release with reason → `released` + hold reversed in ledger
- [ ] Expire → `expired`
- [ ] Cancel with reason → `cancelled`

## Concurrency

- [ ] Concurrent reserve with stale `version` rejected
- [ ] Over-allocation beyond `requested_qty` denied
- [ ] Insufficient availability denied (deterministic snapshot)

## Authority

- [ ] `FINANCE_HEAD` cannot reserve
- [ ] `DISPATCH_MANAGER` cannot fulfill
- [ ] `SUPER_ADMIN` override requires reason

## Search & boards

- [ ] Reservation number / SKU discoverable in operational search index (after index upsert)
- [ ] Ready goods / dispatch / retail / production boards show reservation badge (read-only)

## Forbidden (must NOT occur)

- [ ] No `deductStock` or stock deduction movements
- [ ] No dispatch completion side effects
- [ ] No finance release mutation
- [ ] No customer-facing reservation data

## Grep exception table (Phase 4A.1)

| Pattern | File | Reason |
|---------|------|--------|
| `.insert(` | `supabaseInventoryReservationStore.ts` | Reservation, allocation, movement INSERT only |
| `.update(` | `supabaseInventoryReservationStore.ts` | Optimistic lock on `inventory_reservations` only |
| `inventory_stock` (comment) | `reservationService.ts`, tests | Documents forbidden silent read |

All other `.delete(`, `.rpc(`, `deductStock`, `stock_items`, finance/dispatch helpers: **zero matches** in `src/lib/inventory-reservations/`.
