# Unified operational entity graph

Last updated: 2026-05-24

## Purpose

Unify fragmented operational modules (orders, reservations, cartons, scans, WhatsApp, finance, media) under a **single canonical entity contract** with relationships, ownership, escalation, and read-only projections.

## Location

`src/lib/entity-graph/`

| File | Role |
|------|------|
| `entityTypes.ts` | Canonical entity types and refs |
| `entityRelationships.ts` | Cross-module relationship graph |
| `entityOwnership.ts` | Default owner roles per entity |
| `entityEscalation.ts` | Escalation rules and severity |
| `entityPriority.ts` | Priority bands |
| `entityReadiness.ts` | Readiness / blocker semantics |
| `entitySearchIndex.ts` | In-memory search index contracts |
| `entityProjection.ts` | Deterministic graph projection |

## Canonical entities

`order`, `order_item`, `reservation`, `carton`, `dispatch`, `shipment`, `invoice`, `payment`, `approval_request`, `factory_followup`, `inventory_snapshot`, `scan_event`, `barcode_label`, `whatsapp_packet`, `notification`, `media_document`, `customer_timeline_projection`.

## Safety

- Pure TypeScript contracts
- No network, persistence, or hidden writes
- Demo graph in explorer uses **explicit sample refs** only

## Admin UI

`/admin/entity-graph-explorer` — relationship explorer + search contract demo.
