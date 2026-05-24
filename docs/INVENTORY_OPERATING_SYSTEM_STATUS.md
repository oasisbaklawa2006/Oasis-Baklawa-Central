# Inventory operating system — status

Last updated: 2026-05-20

## What is real in-tree

- Domain vocabulary: movement kinds, carton lifecycle states, reservation lifecycle states (`src/lib/inventory-operating-system/`).
- Reversal and supervisor rules for movement kinds (derivation only).
- Variance and escalation **derivation** from caller-supplied flags (`inventoryRiskDerive.ts`) — not live shelf truth.
- Movement timeline builder for **projection rows** supplied by callers (`inventoryTimeline.ts`).
- Static governance matrix for who may perform which inventory-class actions (`inventoryGovernance.ts`) — not enforced at runtime.

## What is projection-only

- All “ledger” and movement rows until a dedicated append-only persistence layer ships.
- Reservation counts and open-window signals unless the caller binds real data.
- Any UI that merges feeds without wiring satisfaction flags from production systems.

## What still requires persistence

- Immutable movement table (append-only), reversal rows, and RLS.
- Reservation locks and stock holds with idempotency keys.
- Barcode receiving events bound to carton / SKU entities.

## What requires barcode hardware later

- Live scan ingestion, printer drivers, symbology validation on device.

## What requires controlled write activation later

- Posting movements, applying holds, dispatch extraction writes — must go through governance-approved APIs only.
