# Phase 3H — Staging validation

## Preconditions

- [ ] PR #105–#110 merged
- [ ] Migrations 3A/3D + 3C applied
- [ ] 3F boards smoke-tested

## Route gating

- [ ] `/admin/customer-timeline-preview` requires `cmd_war_room`
- [ ] No customer-facing route added

## Projection smoke

1. Pick order with `operational_events` rows
2. Load in preview — steps show curated labels only
3. Verify suppressed count > 0 for orders with blocked/finance events
4. Confirm JSON contract has no `queue_item_id`, `actor`, `department`

## Suppression checks

Orders with finance-hold or escalation events must not show those strings in:
- Step labels
- safe_detail
- Public contract JSON

## gate_scan_verified

- [ ] Timeline must not jump to `dispatched` from gate scan alone

## Network

- [ ] Preview: SELECT on `operational_events` only
- [ ] No notification/whatsapp/sms calls

## Sign-off

| Gate | Date |
|------|------|
| Preview + suppression | |
| Contract shape | |
