# Phase 3I staging validation

## Migration

- [ ] Apply `20260526020000_execution_os_phase3i_operational_search_index.sql`
- [ ] Confirm GIN indexes on `normalized_tokens`, `aliases`, `barcode_values`, `so_numbers`
- [ ] Confirm `REVOKE DELETE` on `operational_search_index`

## RLS

- [ ] Internal staff (`is_internal_staff`) can SELECT
- [ ] Non-staff authenticated user gets zero rows
- [ ] No anon/public policy

## Search UI (`/admin/operational-search`)

- [ ] Route gated with `cmd_war_room`
- [ ] Search box returns result cards or empty state (pre-backfill)
- [ ] Sensitivity / visibility badges visible
- [ ] Suppressed count shown when restricted rows filtered
- [ ] Navigation links open allowed admin pages only
- [ ] No mutation or notification buttons

## Lookup checks

- [ ] SO partial match (`SO-2026-xxx`)
- [ ] Barcode mode finds scan/carton entries when indexed
- [ ] Alias `order:` / `so:` parsing works

## Safety

- [ ] Finance hold / escalation strings not in `customer_safe_candidate` results
- [ ] Mismatch/duplicate scan entries restricted or staff_scoped
- [ ] Raw internal event titles not shown on customer_safe cards

## Backfill

- [ ] Run `buildSearchBackfillDryRunPlan()` report only — no production backfill
- [ ] No cron/scheduler/autoIndex in repo grep

## Side effects

- [ ] No `sendNotification`, payment, invoice, dispatch completion calls from search paths
- [ ] No `customerPublicSearch` route
