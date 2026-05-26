# Execution OS — Phase 3E: Execution Command Center

**Target PR:** `feat(cmd): add execution command center and operational intelligence surfaces`  
**Branch:** `cursor/phase-3e-execution-command-center-6c20`  
**Depends on:** PR #105–#108 merged; 3A/3D + 3C migrations validated in staging

## Mission

Transform CMD visibility into a **read-only Execution Command Center**: SLA pressure, escalation topology, congestion, risk scoring, scan monitoring, ownership matrix, and live operational event stream — **zero business mutations**.

## Routes (internal, `cmd_war_room`)

| Route | Surface |
|-------|---------|
| `/admin/execution-command-center` | Full command center |
| `/admin/execution-risk` | Risk board |
| `/admin/execution-bottlenecks` | Bottleneck graph |

Legacy `/admin/cmd-war-room` remains for order triage; pulse strip links to Execution CMD.

## Intelligence engine (`src/lib/execution-intelligence/`)

| Module | Role |
|--------|------|
| `slaBreachDetection.ts` | fresh / aging / breached / critical |
| `executionRiskScoring.ts` | Deterministic low→critical + confidence |
| `escalationTopology.ts` | Department escalation hotspots |
| `executionCongestion.ts` | Heatmap cells |
| `executionBottleneckAnalysis.ts` | Blocker propagation nodes |
| `queueOwnershipProjection.ts` | Ownership matrix |
| `scanMonitoringProjection.ts` | Mismatch/duplicate/gate pending |
| `operationalEventAggregation.ts` | Stream + customer-safe title suppression |
| `executionCommandCenterProjection.ts` | Orchestrator |

Data hook `useExecutionCommandCenter` — **SELECT only** on `operational_queue_items`, `operational_events`, `operational_scan_records` plus live feed snapshots.

## Out of scope

Dispatch completion, finance/stock mutation, notifications, AI automation, customer-facing CMD, auto-escalation/reassign.

## Verification

```bash
npm run typecheck
npm run build
npm run test -- --run src/lib/execution-intelligence src/lib/barcode-execution src/lib/persistent-queues src/lib/operational-events
```
