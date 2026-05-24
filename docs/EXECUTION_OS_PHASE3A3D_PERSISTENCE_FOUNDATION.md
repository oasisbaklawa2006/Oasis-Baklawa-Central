# Execution OS — Phase 3A/3D persistence foundation

**Migration:** `supabase/migrations/20260525230000_execution_os_phase3a3d_foundation.sql`  
**Code:** `src/lib/persistent-queues/`, `src/lib/operational-events/` (store), `src/lib/execution-authority/`

## Purpose

First **safe write-capable** execution foundation:

- Durable operational queue items with lifecycle + optimistic versioning
- Append-only operational events (source of truth for queue writes)
- Authority guard on every queue mutation
- No finance, stock, dispatch completion, payment, invoice, or customer public binding

## Tables

| Table | Role |
|-------|------|
| `operational_queue_items` | Durable queue work items |
| `operational_queue_assignments` | Assignment history (append rows) |
| `operational_events` | Immutable audit / event store |

## Event immutability

- `BEFORE UPDATE` / `BEFORE DELETE` triggers raise on `operational_events`
- `REVOKE UPDATE, DELETE` from `authenticated` and `anon`
- TypeScript `assertAppendOnlyMutation('insert')` in repositories

## Queue lifecycle

States: `pending` → `acknowledged` → `assigned` → `in_progress` → (`blocked`|`escalated`) → `completed`|`failed`|`cancelled`

Validated in `queueLifecycle.ts` before any DB write.

## Authority placeholder

`execution-authority/` gates `queue:*` actions only. Finance/dispatch/stock business actions are **not defined** and deny via prefix guard.

## Rollback

No row deletes on events. Queue corrections use compensating events + forward transitions (e.g. `failed` → `retry` → `pending`). Override requires `SUPER_ADMIN` (future PR).

## Explicitly forbidden in this PR

- Finance approval / invoice / payment
- Stock reservation / deduction
- Dispatch completion
- Customer timeline publish
- Notifications / Edge / UI mutation buttons

## Wiring

```typescript
import { supabase } from "@/integrations/supabase/client";
import { createSupabasePersistentQueueBundle } from "@/lib/persistent-queues";

const { repository, events } = createSupabasePersistentQueueBundle(supabase);
```

Tests use `createInMemoryPersistentQueueBundle()` — no network.

## Next PR

- Department execution boards (read + action UI)
- Barcode execution records (3C)
- CMD persistent ownership strip (3E)
