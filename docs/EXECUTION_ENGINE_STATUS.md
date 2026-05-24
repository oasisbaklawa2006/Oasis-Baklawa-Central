# Execution dependency engine — status

Last updated: 2026-05-20

## What is real in-tree

- Default dispatch-oriented dependency graph (`executionDependencies.ts`).
- Lane readiness evaluation and dispatch blocking helpers (`executionBlocking.ts`).
- Escalation message derivation from blocked lanes (`executionEscalations.ts`).
- Risk summary and timeline helpers (`executionRiskEngine.ts`, `executionTimeline.ts`).
- `buildExecutionOperationalFeed` — projection records for blocked dispatch and bottlenecks.

## What is projection-only

- All readiness booleans must be supplied by callers; the engine does not read orders or inventory tables itself.
- CMD War Room strip uses **finance pressure only** for the finance lane; other lanes are treated as satisfied in that aggregate view until dedicated feeds exist (documented in UI copy).

## What still requires persistence

- Readiness checkpoints persisted per order / dispatch unit.
- Idempotent transition logs when execution is eventually automated (still governance-gated).

## Autonomy

- No automatic execution or auto-dispatch — derivation and visibility only.
