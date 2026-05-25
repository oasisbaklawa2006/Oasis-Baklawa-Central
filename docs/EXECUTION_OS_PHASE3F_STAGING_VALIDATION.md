# Phase 3F — Staging validation

No new migration. Requires 3A/3D + 3C tables and PR #105–#109 merged.

## Preconditions

- [ ] PR #105–#109 merged
- [ ] Migrations applied in staging
- [ ] Rebase `cursor/phase-3f-department-execution-boards-6c20` onto `main`

## Route / module checks

| Route | Module |
|-------|--------|
| `/admin/execution/production` | `production` |
| `/admin/execution/assembly` | `production` |
| `/admin/execution/ready-goods` | `inventory` |
| `/admin/execution/dispatch` | `dispatch` |
| `/admin/execution/third-party` | `orders` |
| `/admin/execution/retail` | `inventory` |
| `/admin/execution/complaints` | `support` |

- [ ] Unauthorized role redirected from direct URL
- [ ] No customer routes expose boards

## Execution action smoke (OPERATIONS_MANAGER or scoped role)

1. Open production board → select queue item
2. Acknowledge → state + `queue_acknowledged` event
3. Assign → `queue_assigned`
4. Start → `queue_started`
5. Block with reason → `queue_blocked`
6. Add note → `operational_note_added`
7. Attach photo metadata → event metadata contains `operationalPhoto`
8. Carton scan → `operational_scan_records` + scan event
9. Stale version: retry action with old version → error, no silent merge

## Authority

- [ ] FINANCE_EXEC cannot mutate production queue (UI disabled + service denies)

## Customer-safe

- [ ] Drawer timeline suppresses internal finance/governance labels

## Network

- [ ] UI requests: SELECT only on operational tables
- [ ] No `.insert`/`.update` from page components

## Sign-off

| Gate | Date |
|------|------|
| Routes | |
| Actions + events | |
| Scans | |
