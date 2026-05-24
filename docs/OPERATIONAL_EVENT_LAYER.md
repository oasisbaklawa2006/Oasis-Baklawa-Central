# Unified operational event layer (Phase A)

This document describes the **client-side normalization layer** introduced for Oasis Central’s “one nervous system” direction. It is **not** a database event store.

## Goals

- One **canonical vocabulary** of `kind` strings (dotted, namespaced) for cross-module timelines and feeds.
- **Consistent timestamps**: only `occurredAt` values taken from authoritative columns (e.g. `orders.created_at`, `orders.finance_verified_at`). Never fabricate wall-clock times for derived rows.
- **Actor + entity linking** on every record for future CMD / audit surfaces.
- **Append-only mindset**: builders return new arrays; merging uses deterministic ids and dedupes by `id` — no in-place mutation of prior rows.

## Non-goals (this phase)

- New Supabase tables, triggers, or Edge writers.
- Replacing `notification_outbox` or panic alerts.
- WhatsApp / AI-generated synthetic events.

## Code layout

| Path | Role |
|------|------|
| `src/lib/operational-events/types.ts` | `OperationalEventRecord`, categories, severities, `OperationalEventKind` constants |
| `src/lib/operational-events/normalize.ts` | ISO timestamp normalization, sort, dedupe |
| `src/lib/operational-events/orderTraceFeed.ts` | `buildOrderOperationalFeedFromTrace` — **read-only** projection from order trace inputs |
| `src/components/admin/OperationalEventFeedList.tsx` | Mobile-safe list renderer |

## Surfaces

- **Order trace sheet** (`OrderTraceSheet`): renders the unified feed above the legacy “Timeline (hint)” list so operators see one stitched narrative first.

## Extending safely

1. Add a new `OperationalEventKind.*` constant before emitting from a builder.
2. Assign a **deterministic** `id` (e.g. `oe:${orderId}:${kind}`) so merges never duplicate.
3. Leave `occurredAt` null unless a real column backs it.
4. Wire new modules (WhatsApp, dispatch TV, finance board) by **calling the same merge helpers** with their own builders — do not fork parallel type systems.

## Related utilities

- `src/utils/orderTrace.ts` — existing derived timeline / finance / dispatch logic (still source of truth for cursor math).
- **Sprint checkpoint:** `docs/MEGA_SPRINT_OPERATIONAL_READINESS_PHASE_A.md`
