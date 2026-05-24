# Launch blockers — master tracker

Last updated: 2026-05-24

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
| No customer timeline data binding | Timeline is illustrative | Staff-only `CustomerOrderTimeline` preview route |

## Near-term unblockers (typical sequence)

1. Shelf / barcode receiving read model (likely migration + RLS review — separate PR).
2. Reservation table + RLS + operator workflow (writes gated).
3. Print job queue + audit (optional vendor driver).
