# Write authority model

Last updated: 2026-05-20

## Concepts

Each **write action kind** (`WriteActionKind` in `src/lib/write-governance/writeActionKinds.ts`) has a static row in `WRITE_AUTHORITY` describing:

- **requiredRole** — minimum actor label for policy (runtime ACL is out of scope here).
- **requiresHumanConfirmation** — whether UX must capture explicit operator confirmation before an adapter runs.
- **requiresAudit** — audit envelope required when persistence exists.
- **requiresIdempotencyKey** — idempotency token required for safe retries.
- **rollbackKind** — `soft_delete`, `compensating_movement`, `state_revert`, or `none` (see `writeRollback.ts` for human-readable paths).
- **allowedEnvironments** — where this class of write may eventually be enabled (`development`, `staging`, `production`).
- **featureFlagKey** — maps to a key in `WRITE_FEATURE_FLAGS` (`src/config/writeFeatureFlags.ts`).

## Action kinds (current)

| Kind | Primary domain |
|------|----------------|
| `retail.reservation_draft.create` | Retail reservation draft |
| `retail.reservation_draft.cancel` | Retail reservation cancel |
| `retail.factory_followup.create` | Factory follow-up queue |
| `media.attachment_metadata.create` | Media vault metadata |
| `notification.acknowledge` | Notification read/ack state |
| `inventory.reservation_hold.request` | Hold intent (no stock mutation in this foundation) |
| `inventory.reconciliation_note.create` | Reconciliation note |
| `approval.request.create` | Approval routing |

## Enforcement note

The matrix is **documentation and UI preflight** today. Server-side enforcement, RLS, and dual-control logs belong in API middleware and migrations in **separate**, reviewed changes.
