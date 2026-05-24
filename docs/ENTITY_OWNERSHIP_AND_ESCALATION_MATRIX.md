# Entity ownership and escalation matrix

Last updated: 2026-05-24

## Ownership (`entityOwnership.ts`)

Default **primary** and **backup** roles per canonical entity type. All entries are `projectionOnly: true` — advisory until persisted assignment exists.

| Entity | Primary owner |
|--------|----------------|
| order | operations_manager |
| invoice / approval | finance_head |
| dispatch / shipment | dispatch_manager |
| reservation / inventory_snapshot | store_incharge |
| scan_event | security_control |
| whatsapp_packet | support_executive |
| customer_timeline_projection | support_executive |

Queue-level ownership mirrors this in `work-queues/queueOwnership.ts`.

## Escalation (`entityEscalation.ts`)

| Trigger | Entity | Tier | Customer impact |
|---------|--------|------|-----------------|
| finance_hold_stale | approval_request | department_head | yes |
| dispatch_panic | dispatch | cmd | yes |
| scan_exception | scan_event | team_lead | no |
| inventory_unverified | reservation | department_head | yes |
| stale_idle | whatsapp_packet | team_lead | yes |
| production_slip | factory_followup | department_head | yes |

**No auto-escalation jobs** — recommendations are human-readable strings only.

## Severity propagation

`dependency-graph` and `entityPriority` combine blocker depth, customer impact, and lane type to derive `operationalSeverity` for queue ordering.
