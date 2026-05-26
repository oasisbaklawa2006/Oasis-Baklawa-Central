# Live work queue foundation

Last updated: 2026-05-25

## Purpose

Projection-only work queues that unify operational attention across finance, production, assembly, dispatch, retail, governance, inventory, scans, and customer support.

## Location

`src/lib/work-queues/`

## Queues

- `finance_review_queue`
- `production_queue`
- `assembly_queue`
- `dispatch_queue`
- `retail_followup_queue`
- `reservation_verification_queue`
- `governance_review_queue`
- `inventory_verification_queue`
- `scan_exception_queue`
- `customer_support_queue`

## Queue item fields

Entity refs, priority, readiness, blockers, owner role, escalation state, dependency state, customer impact, aging, operational severity.

## Pressure semantics

`pressureCount` is **null** when a feed is not connected — never coerced to zero.

**Hardened:** `projectWorkQueues` does **not** derive pressure from `items.length`. Callers must pass `pressureByQueue` explicitly.

## Live read-only feeds (`src/lib/live-feeds/`)

| Adapter | Source (select-only) |
|---------|----------------------|
| `financeQueueFeed` | War Room orders · finance hold derivation |
| `productionQueueFeed` | Orders in production pipeline statuses |
| `assemblyQueueFeed` | Assembly / partial_ready / packed_ready |
| `dispatchQueueFeed` | Dispatch pipeline + panic urgency |
| `readyGoodsQueueFeed` | `packed_ready` orders |
| `thirdPartyQueueFeed` | `needs_clarification` proxy |
| `customerRiskQueueFeed` | Finance + panic + triage + support tickets |
| `escalationQueueFeed` | Advisory escalation topics |
| `blockerQueueFeed` | Dependency graph root blocker |
| `cmdPressureFeed` | Aggregated pressures + unified blocker |

Hook: `useOperationalLiveFeeds` (Supabase **select only** in hook — adapters stay pure).

## Admin UI

`/admin/live-work-queues` — live feed cards, filters, read-only item drawer. **Module guard:** `cmd_war_room` via `AdminModuleRoute`.

`/admin/entity-graph-explorer` — order/customer/finance/dispatch/production nodes from same feed context.

## Persistent foundation (Phase 3A/3D)

- Migration: `20260525230000_execution_os_phase3a3d_foundation.sql`
- Write path: `createPersistentQueueRepository` + `createSupabaseOperationalEventRepository`
- See `docs/EXECUTION_OS_PHASE3A3D_PERSISTENCE_FOUNDATION.md`

## Safety

No queue claim UI, reassignment UI, auto-escalation, or notification sends in admin shells (repository API exists for gated future PRs).
