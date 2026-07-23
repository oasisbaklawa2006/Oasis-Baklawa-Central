# App-Verse Point 15 — Supabase Core Migration and Shared-Contract Authority

Date: 2026-07-23
Point: 15

## Purpose

Freeze `oasisbaklawa2006/oasis-supabase-core` as the single authoritative repository for shared database migrations, row-level security, shared RPCs, Edge Functions, storage policies, event/audit primitives and cross-application backend contracts.

## Truth classification

- DOCUMENTED: yes
- CODED: no
- MIGRATED: no
- TESTED: documentation consistency only
- DEPLOYED: no runtime change
- RUNTIME VERIFIED: no

## Canonical authority rule

The application repositories may consume shared contracts, generate typed clients and propose changes, but they may not independently become the authoritative source for shared production schema or shared backend behaviour.

## Ownership matrix

| Capability | Canonical owner | Consumer responsibilities |
|---|---|---|
| Shared schema and migrations | Supabase Core | apps consume generated/declared contracts |
| RLS and grants | Supabase Core | apps must not bypass policies |
| Shared RPCs | Supabase Core | apps call versioned interfaces |
| Shared Edge Functions | Supabase Core | apps invoke through governed contracts |
| Shared storage buckets/policies | Supabase Core | apps respect scope and file policy |
| Event and audit primitives | Supabase Core | domain apps emit valid records |
| Auth extensions and claims | Supabase Core | apps project role-aware experiences |
| Product editorial state | AI Studio | Core persists governed shared contract where applicable |
| Operational order state | Central | Core owns shared schema/RPC contract where applicable |
| Physical evidence | Trace | Core owns shared ingest contract where applicable |
| Customer-safe projections | Core contract, sourced from Central/AI Studio | Customer App consumes read-safe interfaces |

## Migration rules

1. Every production migration must have one immutable filename and one canonical home in Supabase Core.
2. Application-local migrations affecting shared schema are proposals only until reconciled into Core.
3. Duplicate or divergent migrations must be quarantined, compared and retired through evidence-backed reconciliation.
4. Applied migrations must never be silently edited in place.
5. Destructive changes require dependency search, data-migration proof, rollback plan and staged promotion.
6. Environment promotion follows development, preview/staging, UAT and production gates defined by Point 14.
7. Schema drift between production and Core is a defect and must be surfaced by CI under Point 25.

## Contract rules

- Shared RPCs and functions require explicit versioning and backwards-compatibility policy.
- Customer-facing contracts must expose only customer-safe fields.
- Service-role credentials remain backend-only.
- Apps must fail closed when a required shared contract is unavailable.
- Direct table access is permitted only when the contract explicitly allows it and RLS enforces scope.
- Generated types are outputs, not migration authority.
- Contract ownership does not transfer domain decision authority away from AI Studio, Central or Trace.

## Repository workflow

1. Domain repository raises a contract change proposal.
2. Supabase Core records schema/RLS/RPC/function change.
3. Contract tests and migration validation run.
4. Consumer repositories update generated types/adapters.
5. Staging/UAT evidence is recorded.
6. Production promotion is exact-SHA and migration-version traceable.
7. Rollback or forward-fix path is documented.

## Existing state reconciliation

Open Supabase Core PRs and application-local migrations must be reviewed against this authority model. Existing production objects are credited as baseline, but any object without a canonical Core migration/contract record remains reconciliation debt rather than proof of complete authority.

## Completion criteria for this governance point

- canonical repository named;
- ownership boundaries frozen;
- migration rules frozen;
- contract rules frozen;
- application-local proposal rule frozen;
- reconciliation and promotion workflow frozen;
- later implementation dependencies identified.

> **POINT 15 — COMPLETE**
