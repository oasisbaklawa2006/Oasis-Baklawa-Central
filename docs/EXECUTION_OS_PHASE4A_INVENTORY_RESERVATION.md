# Phase 4A — Governed inventory reservation engine

## Architecture

Reservation-first inventory governance with:

- **`inventory_reservations`** — versioned reservation rows
- **`inventory_reservation_allocations`** — entity-level allocation lines
- **`inventory_movements`** — append-only ledger (no stock deduction in this phase)

All writes flow through `createReservationRepository` → `operational_events` + `inventory_movements`.

## Library layout

| Module | Path |
|--------|------|
| Engine | `src/lib/inventory-reservations/reservationService.ts` |
| Repository | `reservationRepository.ts`, `inMemoryReservationStore.ts` |
| Availability | `reservationAvailability.ts` |
| Authority | `src/lib/inventory-authority/` |
| Board projection | `reservationProjection.ts` |
| Search | `reservationSearchProjection.ts` |

## Availability formula

```
available = physical_stock
  - reserved_open
  - blocked_inventory
  - damaged_inventory
  - expired_inventory
  - quarantine_inventory
```

## Out of scope

Stock deduction, dispatch completion, invoice generation, finance release, auto-allocation AI, customer public inventory.
