# Phase 4A staging validation — Inventory reservation engine

## Migration

- [ ] Apply `20260526030000_execution_os_phase4a_inventory_reservation.sql`
- [ ] Verify `inventory_movements` UPDATE/DELETE raises exception
- [ ] Verify RLS: internal staff only

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
