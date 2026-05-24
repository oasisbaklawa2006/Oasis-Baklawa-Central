# Write preflight and audit contracts

Last updated: 2026-05-20

## Preflight result

All validators in `src/lib/write-governance/writePreflight.ts` return `WritePreflightResult`:

| Field | Meaning |
|-------|---------|
| `allowed` | `true` only when `blockers` is empty |
| `blockers` | Hard stops (missing fields, disabled feature flag, policy text) |
| `warnings` | Non-blocking guidance |
| `auditRequired` | From authority matrix |
| `idempotencyRequired` | From authority matrix |
| `rollbackPath` | Human-readable reversal route label (`rollbackPathForWriteAction`) |

Validators **never** import Supabase or call the network.

## Audit envelope

`buildWriteAuditEnvelope` (`writeAuditEnvelope.ts`) returns a versioned object including:

- Action kind, actor role, optional actor id
- Entity refs (`OperationalEntityRef`)
- `beforeSnapshot` / `afterSnapshotPreview`
- Reason, client timestamp (caller clock, not asserted as server time)
- Idempotency key, correlation id, rollback plan
- Snapshot of all write feature flags
- **`persisted: false`** in this foundation

Nothing in this builder writes to storage.

## Idempotency

`deriveWriteIdempotencyKey` combines action kind, normalized scope key, actor id, and correlation id with a deterministic FNV-1a hash. Same inputs yield the same key across retries; no randomness.
