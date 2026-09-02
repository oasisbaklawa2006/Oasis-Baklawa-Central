# R4.5 — 3PGS Command Centre execution contract

Controlling issues: #407 and #368.

Certified synchronization checkpoint (exact-head evidence only): at Central `main` `1752bbdb6f81eadce0236c97fe43357e6fb4e9de` (merged Buyer #435), post-#435 rebase was certified at PR head `b36686b80a3f5f5a9020cf15b3fba2eec27b3b81`; doc contract alignment was certified at PR head `5eb70900d8e474256b626cbf3069bbb87e858773` (docs-only, same base). These record point-in-time certifications only — not a forever-current state. Any later advance of Central `main` or PR head requires fresh resynchronization and new exact-head evidence before merge approval. Historical checkpoints: `9435676b88d11888d39f3302a2c4f17495a6ae50` (pre-#435) and `8d24c99464558ccfcd9ca0cb7be538025f7f638c` (merged FACT-C3 #423 + Buyer #431).

## Purpose

Compose existing governed 3PGS source truth into one manager-facing operational command surface. This phase does not create new stock, reservation, procurement, issue, receipt, or audit authority.

## Canonical inputs to compose

- `inventory_stock_balances` (including aggregate `reserved_qty` as the R4.5 reservation-visibility boundary)
- `b2b_3pgs_pending_demand_priority`
- `b2b_procurement_requirements`
- `b2b_assembly_3pgs_requirements`
- governed issue events and distinct receiver acknowledgement
- `b2b_inventory_receipts` / receipt lines
- R4.3 governed put-away / GRN path
- R4.4 governed post-GRN exception path

The canonical 3PGS inventory/store code is `3PGS`. `STORE_3RD_PARTY` is an application role identifier and must not be used as `location_code` or `destination_store_code` in this command-centre read path.

R4.5 does not read `inventory_reservations` directly. Aggregate reserved quantity is composed from `inventory_stock_balances.reserved_qty` for manager visibility only. The existing governed operator at `ThreePgsProcurementQueue.tsx` remains canonical for reservation actions through Core RPCs; this command centre introduces no reservation mutation authority.

## Existing Central surface to extend

The existing operator implementation remains canonical at `src/pages/admin/ThreePgsProcurementQueue.tsx`. R4.5 does not copy, rename, or replace that mutation surface.

The existing route `/admin/3pgs-procurement-queue` now lazy-loads `ThreePgsProcurementQueueComposition.tsx`, a narrow route-level composition wrapper that renders:

- `ThreePgsCommandCentre.tsx` — read-only manager composition over canonical Core-backed truth;
- `ThreePgsProcurementQueue.tsx` — the unchanged pre-R4.5 governed operator implementation, still owning procurement, reserve, issue, distinct-receiver acknowledgement and receiving actions through the existing Core RPC paths.

This avoids a parallel route, duplicate operator implementation, or new mutation authority. The original operator regression suite remains unchanged and continues to target `ThreePgsProcurementQueue.tsx` directly.

## Required behaviour

1. Present strict source-truth demand priority: P&A > outlet booked stock > B2B advance orders > other authorised demand.
2. Present 3PGS stock buckets from `inventory_stock_balances` without direct writes.
3. Present aggregate reserved quantity from `inventory_stock_balances.reserved_qty` alongside demand without synthesising parallel availability or reading `inventory_reservations` directly.
4. Present procurement/vendor and inbound receipt/GRN progress.
5. Preserve existing governed reserve, issue, distinct-receiver acknowledgement, procurement and receiving RPC calls.
6. Deep-link/reuse existing R4.3 receiving/put-away/GRN and R4.4 post-GRN exception surfaces rather than duplicating them.
7. Explicit loading, empty and failure states.
8. Focused tests must prove source-truth composition and absence of direct stock mutation.
9. Query failures must surface as real `Error` instances rather than throwing raw provider objects.

## Non-goals

- no schema/migration unless a separately proven Core gap exists;
- no direct stock writes;
- no copied or parallel 3PGS operator implementation;
- no R4.6 satellite/mobile/TV behaviour;
- no R4.7 close/audit behaviour;
- no R5 Dispatch behavioural work;
- no resurrection of legacy `operational_queue_items` or `order_items` as 3PGS stock authority.

## Exit

R4.5 exits only after exact-head CI, Codacy, security and fresh review are clean on the synchronized branch, then the PR is approved and merged. R4.6 follows only after that merge. Dispatch remains held until #407 reaches launch-ready closure after R4.7; physical UAT #408 may continue independently.
