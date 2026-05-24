# Dependency graph and blockers

Last updated: 2026-05-25

## Purpose

Operational dependency lanes (finance → production → assembly → dispatch → shipment, plus reservation / inventory verification) with **root blocker** detection and downstream impact strings.

## Location

`src/lib/dependency-graph/`

## Outputs

- `rootBlocker` — shallowest unsatisfied lane
- `downstreamImpact` — human-readable blocked downstream labels
- `customerImpact` — whether customer-facing lanes are affected
- `escalationRecommendation` — advisory copy only (no auto jobs)
- `operationalSeverity` — propagated severity band

## Example chains

| Upstream | Downstream blocked |
|----------|-------------------|
| Finance pending | Production, assembly, dispatch |
| Missing invoice | Shipment |
| Missing scan | Dispatch / gate exit |
| Missing inventory verification | Reservation confirmation |

## CMD integration

`blockerQueueFeed` + `cmdPressureFeed` feed the unified blocker lane in CMD pulse and `/admin/live-work-queues` via `aggregateLiveFeeds()`.
