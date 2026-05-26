# Phase 3E — Staging validation

No new migration. Requires persistent queue, event, and scan tables from 3A/3D and 3C.

## Preconditions

- [ ] PR #105–#108 merged
- [ ] Migrations `20260525230000_*` and `20260526010000_*` applied
- [ ] Rebase `cursor/phase-3e-execution-command-center-6c20` onto `main`

## Route gating

- [ ] `/admin/execution-command-center` requires `cmd_war_room` module
- [ ] `/admin/execution-risk`, `/admin/execution-bottlenecks` same guard
- [ ] Production/customer roles cannot access routes

## Projection verification

- [ ] Open queues appear in pressure strip when `operational_queue_items` has rows
- [ ] SLA board shows aging/breached for old items
- [ ] Scan hotspots populate when `operational_scan_records` has mismatch rows
- [ ] Event stream shows scan/queue events; finance-hold titles show `[Staff] Operational update`
- [ ] No write buttons on command center pages

## Determinism

Run twice with same DB snapshot — risk scores and ordering must match.

## Customer-safe

- [ ] Event stream does not surface raw "finance hold" titles to customer routes (N/A — staff only page)
- [ ] Customer-risk lane labeled staff-only

## Network tab

- [ ] Only `select` on operational_* tables from hook — no `insert`/`update`/`delete` from UI

## Sign-off

| Gate | Date |
|------|------|
| Routes + RLS read | |
| Projections | |
| No mutation leakage | |
