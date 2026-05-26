# Customer-safe projection rules

Last updated: 2026-05-25

## Purpose

Transform internal operational graph and timeline inputs into **curated customer-facing** progression without exposing operational chaos.

## Location

`src/lib/customer-safe/`

## Suppressed content

- Finance hold / internal disputes
- Governance conflict and raw governance logs
- CMD / escalation / panic vocabulary
- Shadow client / waste / duplicate internals

## Audience

Uses `operational-timeline` visibility rules with `customer_safe` audience — only `public_curated` (and sanitized operational) events pass through.

## Components

- `customerSafeStatus.ts` — status catalog + suppression helpers
- `customerSafeTimeline.ts` — **public_curated only** (operational/internal classes rejected)
- `customerProjection.ts` — order-level safe bundle
- `customerTimelineProjection.ts` — curated 10-step customer journey (Order Placed → support window)

## Hardened rules (2026-05-25)

- Only `public_curated` visibility passes customer_safe filter (whitelist).
- Operational, finance_internal, governance_internal, escalation_internal are dropped.
- Expanded suppressed vocabulary (owner, department, staff, hod, manager, …).

## Public exposure

Staff preview remains at `/admin/customer-timeline-preview`. Public routes must stay behind auth + order ownership (future PR).
