# R4.5 — 3PGS Command Centre execution contract

Controlling issues: #407 and #368.

Current-main reconciliation: R4.5 is synchronized through Central `main` `8d24c99464558ccfcd9ca0cb7be538025f7f638c`, which includes merged FACT-C3 #423 and Buyer #431.

## Purpose

Compose existing governed 3PGS source truth into one manager-facing operational command surface. This phase does not create new stock, reservation, procurement, issue, receipt, or audit authority.

## Canonical inputs to compose

- `inventory_stock_balances`
- `inventory_reservations`
- `b2b_3pgs_pending_demand_priority`
- `b2b_procurement_requirements`
- `b2b_assembly_3pgs_requirements`
- governed issue events and distinct receiver acknowledgement
- `b2b_inventory_receipts` / receipt lines
- R4.3 governed put-away / GRN path
- R4.4 governed post-GRN exception path

The canonical 3PGS inventory/store code is `3PGS`. `STORE_3RD_PARTY` is an application role identifier and must not be used as `location_code` or `destination_store_code` in this command-centre read path.

## Existing Central surface to extend

The existing route and import path remain canonical: `src/pages/admin/ThreePgsProcurementQueue.tsx` at `/admin/3pgs-procurement-queue`.

R4.5 keeps that path and converts it into a narrow route-level composition wrapper:

- `ThreePgsCommandCentre.tsx` — read-only manager composition over canonical Core-backed truth;
- `ThreePgsProcurementOperator.tsx` — the pre-R4.5 governed operator implementation, preserved byte-for-byte from current `main` and still owning procurement, reserve, issue, distinct-receiver acknowledgement and receiving actions.

This avoids adding a parallel route or mutation surface and avoids changing `src/App.tsx` merely to introduce R4.5 composition.

## Required behaviour

1. Present strict source-truth demand priority: P&A > outlet booked stock > B2B advance orders > other authorised demand.
2. Present 3PGS stock buckets from `inventory_stock_balances` without direct writes.
3. Present reservations/coverage against demand without synthesising parallel availability.
4. Present procurement/vendor and inbound receipt/GRN progress.
5. Preserve existing governed reserve, issue, distinct-receiver acknowledgement, procurement and receiving RPC calls.
6. Deep-link/reuse existing R4.3 receiving/put-away/GRN and R4.4 post-GRN exception surfaces rather than duplicating them.
7. Explicit loading, empty and failure states.
8. Focused tests must prove source-truth composition and absence of direct stock mutation.
9. Query failures must surface as real `Error` instances rather than throwing raw provider objects.

## Non-goals

- no schema/migration unless a separately proven Core gap exists;
- no direct stock writes;
- no R4.6 satellite/mobile/TV behaviour;
- no R4.7 close/audit behaviour;
- no R5 Dispatch behavioural work;
- no resurrection of legacy `operational_queue_items` or `order_items` as 3PGS stock authority.

## Exit

R4.5 exits only after exact-head CI, Codacy, security and fresh review are clean on the synchronized branch, then the PR is approved and merged. R4.6 follows only after that merge. Dispatch remains held until #407 reaches launch-ready closure after R4.7; physical UAT #408 may continue independently.
