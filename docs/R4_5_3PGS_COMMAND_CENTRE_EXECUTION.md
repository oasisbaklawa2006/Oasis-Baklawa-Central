# R4.5 — 3PGS Command Centre execution contract

Controlling issues: #407 and #368.

Base: `d8d5fbca4042164eafe1056080ab588918446fea` (R4.4 merged).

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

## Existing Central surface to extend

`src/pages/admin/ThreePgsProcurementQueue.tsx` already composes the governed priority view, procurement requirements, P&A requirements, reservations, issue events and receipt creation/disposition. R4.5 must extend this existing surface rather than introduce a parallel queue.

The verified missing composition is the manager stock-position and receipt/GRN visibility needed to understand demand coverage and inbound state without leaving the 3PGS command surface.

## Required behaviour

1. Present strict source-truth demand priority: P&A > outlet booked stock > B2B advance orders > other authorised demand.
2. Present 3PGS stock buckets from `inventory_stock_balances` without direct writes.
3. Present reservations/coverage against demand without synthesising parallel availability.
4. Present procurement/vendor and inbound receipt/GRN progress.
5. Preserve existing governed reserve, issue, distinct-receiver acknowledgement, procurement and receiving RPC calls.
6. Deep-link/reuse existing R4.3 receiving/put-away/GRN and R4.4 post-GRN exception surfaces rather than duplicating them.
7. Explicit loading, empty and failure states.
8. Focused tests must prove source-truth composition and absence of direct stock mutation.

## Non-goals

- no schema/migration unless a separately proven Core gap exists;
- no direct stock writes;
- no R4.6 satellite/mobile/TV behaviour;
- no R5 Dispatch behavioural work;
- no resurrection of legacy `operational_queue_items` or `order_items` as 3PGS stock authority.

## Exit

R4.5 exits only after exact-head CI/review is clean. R4.6 follows. Dispatch remains held until #407 reaches launch-ready closure after R4.7; physical UAT #408 may continue independently.
