# Customer timeline foundation — status

Last updated: 2026-05-24

## Delivered

- `src/components/customer/CustomerOrderTimeline.tsx` — curated, customer-safe steps (placed → finance → manufacturing → … → 10-day support window).
- `src/pages/admin/CustomerTimelinePreview.tsx` — **staff-only** preview under `/admin/customer-timeline-preview`.
- `src/lib/customer-safe/` — suppression rules, safe timeline projection, order bundle (`customerProjection.ts`).
- `src/lib/operational-timeline/` — audience layers including `customer_safe` visibility rules.

## Rules

- No raw operational logs, internal chaos labels, or dispatch panic vocabulary.
- Default content is **static** until bound to real order milestones in a future PR.
- Public customer exposure is **out of scope** for this block; reuse the component inside authenticated buyer flows later.

## Next steps

- Map each step to **order status** and finance flags from existing order models.
- Add accessibility review and localization for customer copy.
- Gate any public route behind auth + order ownership checks.
