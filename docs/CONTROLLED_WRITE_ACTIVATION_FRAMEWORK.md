# Controlled write activation framework

Last updated: 2026-05-20

## Purpose

Oasis Central stays **projection-first** until a deliberate program enables persistence. This framework defines **contracts only**: action kinds, authority expectations, preflight validation, audit envelopes, idempotency keys, rollback semantics, and compile-time feature flags. It does **not** turn on database writes, Edge functions, notification sending, or C2C execution.

## Where it lives

| Area | Path |
|------|------|
| Authority matrix | `src/lib/write-governance/writeAuthorityMatrix.ts` |
| Preflight validators | `src/lib/write-governance/writePreflight.ts` |
| Audit envelope builder | `src/lib/write-governance/writeAuditEnvelope.ts` |
| Idempotency derivation | `src/lib/write-governance/writeIdempotency.ts` |
| Feature flags (constants) | `src/config/writeFeatureFlags.ts` |
| Write-intent operational feed | `src/lib/operational-events/writeIntentFeed.ts` |
| Retail UI shells | `src/pages/admin/StoreCoordination.tsx` (preview modals) |

## Invariants

- Validators are **pure**: no network, no Supabase client, no side effects.
- Audit envelopes set `persisted: false` until an approved adapter persists them.
- All `WRITE_FEATURE_FLAGS` default to **false**; no environment reads in this layer.
- Any future real write must sit behind explicit review: table design, RLS, rollback, audit trail.

## Related docs

- `docs/WRITE_AUTHORITY_MODEL.md`
- `docs/WRITE_PREFLIGHT_AND_AUDIT_CONTRACTS.md`
- `docs/WRITE_FEATURE_FLAG_REGISTER.md`
- `docs/FIRST_SAFE_PERSISTENCE_CANDIDATES.md`
