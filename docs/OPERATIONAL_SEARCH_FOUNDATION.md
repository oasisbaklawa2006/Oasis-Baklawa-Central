# Operational search foundation

Last updated: 2026-05-24

## Purpose

Unified search **contracts** for operators — no real indexing or network yet.

## Location

`src/lib/operational-search/`

## Supported kinds

SO number, UUID, barcode, carton, phone, WhatsApp packet, reservation, dispatch, invoice, shipment, customer.

## Features

- Query alias inference (`so:`, `wa:`, phone patterns)
- Grouping and priority sort
- `pendingKinds` when no hits for a kind (honest empty state)

## Usage

Pass in-memory `OperationalSearchHit[]` from projections; call `searchOperationalIndex(hits, { text, limit })`.

Entity graph explorer demonstrates client-side search over demo nodes.
