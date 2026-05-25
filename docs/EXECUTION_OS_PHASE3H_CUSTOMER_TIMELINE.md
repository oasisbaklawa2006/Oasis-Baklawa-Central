# Execution OS — Phase 3H: Customer timeline engine

**Target PR:** `feat(customer): add customer-safe timeline engine from operational events`  
**Branch:** `cursor/phase-3h-customer-timeline-engine-6c20`

## Mission

Derive **customer-safe timelines** only from `operational_events` via approved mappings and a permanent suppression firewall. Staff preview only — no public customer release or notifications.

## Engine (`src/lib/customer-timeline/`)

| Module | Role |
|--------|------|
| `customerTimelineSuppression.ts` | Firewall on title/message/metadata/actor/department |
| `customerTimelineEventMapper.ts` | Approved event → status mappings |
| `customerTimelineProjection.ts` | Full narrative projection |
| `customerTimelineContract.ts` | `CustomerTimelinePublicContract` for future app |
| `customerTimelineSupportWindow.ts` | 10-day window after delivered |
| `customerTimelineComplaintProjection.ts` | Complaint state overlay |

## Key rules

- No raw event title/message in customer output
- `gate_scan_verified` → packing prep only (not dispatch completion)
- `public_candidate` visibility does **not** auto-publish unsafe content
- Internal event types always suppressed (blocked, failed, mismatch, etc.)

## Preview

`/admin/customer-timeline-preview` — `cmd_war_room` gated, read-only SELECT on `operational_events`.

## Out of scope

Public release, notifications, order mutation, finance/dispatch/stock execution.
