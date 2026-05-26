# Launch blockers — master tracker

Last updated: 2026-05-25

This document lists **cross-cutting** operational launch risks. Module-specific gaps live in `docs/OPERATIONAL_MODULE_COMPLETION_MATRIX.md`.

## Global invariants (non-negotiable)

- No autonomous automation from admin shells until explicitly approved.
- No stock deduction or reservation auto-confirmation from coordination UIs.
- No hidden database writes — local drafts must stay local until a reviewed backend path exists.
- Customer-facing surfaces must not expose raw operational logs.

## Current hard blockers

| Blocker | Impact | Mitigation in tree |
|--------|--------|---------------------|
| No shelf-level inventory feed | Retail promises unsafe | Honest copy + manual verification + `factory_inventory` read-only snapshot only |
| No reservation persistence API | Prebooking not enforceable | Local-only drafts on Store coordination; disabled backend submit |
| No label print adapter | Physical labels manual | Label Command Center JSON payloads only |
| No movement ledger persistence | Inventory OS is architecture-only | Feeds and admin boards stay projection-only; no silent writes in new libs |
| No scan event store | Anomaly math exists without authoritative timeline | CMD shows **pending** for scan anomaly count until a bounded feed is wired |
| No customer timeline data binding | Timeline is illustrative | Staff-only `CustomerOrderTimeline` preview route |
| Work queue persistence not wired to UI | Schema + repos landed in Phase 3A/3D PR; admin still read-only | `operational_queue_items`, `operational_events`, `persistent-queues` — no board write buttons yet |
| Entity graph still projection-only | Explorer read-only | `entity-graph` + live feeds |
| No unified operational search index | Search is contract-only over in-memory hits | `searchFeedAdapter.ts` documents future index; no indexing job |
| Live feeds are bounded War Room window | Queue/graph show latest ~200 orders only | Documented in UI; not global backlog totals |
| Scan / reservation queue pressure | Still null until scan store + reservation API | CMD + live queues show **pending** |

## Near-term unblockers (typical sequence)

1. Shelf / barcode receiving read model (likely migration + RLS review — separate PR).
2. Reservation table + RLS + operator workflow (writes gated).
3. Print job queue + audit (optional vendor driver).
