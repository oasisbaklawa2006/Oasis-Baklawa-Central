# Live work queue foundation

Last updated: 2026-05-24

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

War Room wires explicit counts via `cmdQueuePressure.ts` (finance hold, dispatch panic, triage review).

## Admin UI

`/admin/live-work-queues` — queue cards, dependency ribbon, owner lanes (read-only).

## Safety

No queue claim, reassignment, auto-escalation, or notification sends.
