# Barcode scan lifecycle — status

Last updated: 2026-05-20

## What is real in-tree

- Scan event input model and anomaly taxonomy (`scanEventTypes.ts`).
- Pure `deriveScanAnomalies` for duplicate, ordering, missing payload, and dispatch-without-finance-release (`scanLifecycle.ts`).
- Deterministic payload builders for product, carton, dispatch, reservation, transfer, and pickup domains (`scanPayloadBuilders.ts`).
- Policy notes in `barcodeGovernance.ts` (no enforcement).

## What is projection-only

- `buildBarcodeOperationalFeed` — turns anomaly derivation into operational timeline rows with `occurredAt: null` until a real event store exists.

## What still requires persistence

- Scan event log (ordered, auditable), device attestation, and correlation to physical cartons.

## Hardware / printer

- No printer or scanner integration in this block.
