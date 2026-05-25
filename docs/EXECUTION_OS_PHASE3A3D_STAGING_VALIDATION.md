# Phase 3A/3D — Staging validation checklist

**Migration:** `supabase/migrations/20260525230000_execution_os_phase3a3d_foundation.sql`  
**Apply in:** staging only until production sign-off  
**Prerequisite:** PR #105 merged to `main`; PR #106 rebased onto latest `main`

---

## Pre-apply

- [ ] Confirm target is **staging** project (not production)
- [ ] Backup or snapshot staging DB if policy requires
- [ ] PR #105 on `main` (read-only live feeds)
- [ ] PR #106 rebased; no duplicate #104/#105 file conflicts

```bash
# From repo root (staging credentials)
supabase db push --linked
# OR apply migration via Supabase SQL editor / CI migrate job
```

---

## Post-apply checklist

### Tables and indexes

- [ ] `operational_queue_items` exists
- [ ] `operational_queue_assignments` exists
- [ ] `operational_events` exists
- [ ] Indexes: `idx_operational_queue_items_queue_state`, `_order_id`, `_assigned_to`, `_owner_department`, `_sla_due_at`
- [ ] Partial unique: `idx_operational_queue_items_source_entity` (open items only)
- [ ] Event indexes: entity, order, queue_item, correlation_id, idempotency_key

### RLS

- [ ] RLS **enabled** on all three tables
- [ ] **anon:** no SELECT/INSERT/UPDATE policies (default deny)
- [ ] **authenticated customer/non-staff:** no access (verify with test user if available)
- [ ] **internal staff** (`is_internal_staff(auth.uid())`): SELECT on all three
- [ ] **authenticated staff:** INSERT/UPDATE on `operational_queue_items` only (no DELETE policy)
- [ ] **authenticated staff:** INSERT on `operational_queue_assignments` only (no UPDATE/DELETE policy)
- [ ] **authenticated staff:** INSERT on `operational_events` only

### Event immutability

- [ ] `REVOKE UPDATE, DELETE` on `operational_events` for `authenticated`, `anon`
- [ ] Triggers `trg_operational_events_no_update` and `trg_operational_events_no_delete` exist
- [ ] Staging SQL: UPDATE/DELETE on events **fails** (see snippets below)

### Queue semantics

- [ ] `operational_queue_assignments` has no UPDATE/DELETE policies (append-only via INSERT)
- [ ] Duplicate **open** queue item (same `source`, `queue_type`, `entity_type`, `entity_id`) **fails** unique index
- [ ] After `completed` or `cancelled`, new open item for same entity **allowed** (partial index excludes terminal states)

### Service role

- [ ] **service_role** bypasses RLS (Supabase default). Document: migrations/backfills may use service_role; **app repositories use authenticated staff JWT** only.
- [ ] Event immutability triggers still block UPDATE/DELETE even for table owner unless trigger is dropped — triggers apply to all roles including service_role.

---

## SQL validation snippets

Run in Supabase SQL editor (staging) as appropriate role.

### 1. Table existence

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'operational_queue_items',
    'operational_queue_assignments',
    'operational_events'
  )
ORDER BY 1;
-- Expect 3 rows
```

### 2. Index existence

```sql
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'operational_queue_items',
    'operational_queue_assignments',
    'operational_events'
  )
ORDER BY tablename, indexname;
```

### 3. RLS enabled

```sql
SELECT relname, relrowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND relname IN (
    'operational_queue_items',
    'operational_queue_assignments',
    'operational_events'
  );
-- relrowsecurity = true for all
```

### 4. Policy existence

```sql
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'operational_queue_items',
    'operational_queue_assignments',
    'operational_events'
  )
ORDER BY tablename, policyname;
```

Expected policies (authenticated):

| Table | Policy | CMD |
|-------|--------|-----|
| operational_queue_items | Staff read operational queue items | SELECT |
| operational_queue_items | Staff insert operational queue items | INSERT |
| operational_queue_items | Staff update operational queue items | UPDATE |
| operational_queue_assignments | Staff read … | SELECT |
| operational_queue_assignments | Staff insert … | INSERT |
| operational_events | Staff read … | SELECT |
| operational_events | Staff insert … | INSERT |

No DELETE policies on any table.

### 5. Trigger existence (events)

```sql
SELECT tgname, tgrelid::regclass AS table_name
FROM pg_trigger
WHERE tgrelid IN (
  'public.operational_events'::regclass
)
  AND NOT tgisinternal;
```

### 6. Insert operational_event (as staff / service_role for smoke)

Replace UUIDs with valid staging IDs.

```sql
-- Smoke insert (use service_role in SQL editor or authenticated staff session)
INSERT INTO public.operational_events (
  event_type,
  entity_type,
  entity_id,
  actor_id,
  actor_role,
  visibility,
  severity,
  title,
  correlation_id
) VALUES (
  'queue_created',
  'order',
  '00000000-0000-4000-8000-000000000099',
  '00000000-0000-4000-8000-000000000001',
  'OPERATIONS_MANAGER',
  'internal',
  'info',
  'Staging validation event',
  'staging-validate-' || gen_random_uuid()::text
)
RETURNING id, created_at;
```

### 7. UPDATE operational_events must fail

```sql
-- Replace <event_id> from prior insert
UPDATE public.operational_events
SET title = 'mutated'
WHERE id = '<event_id>';
-- Expect: ERROR operational_events are append-only
```

### 8. DELETE operational_events must fail

```sql
DELETE FROM public.operational_events WHERE id = '<event_id>';
-- Expect: ERROR operational_events are append-only
```

### 9. Duplicate open queue item must fail

```sql
INSERT INTO public.operational_queue_items (
  queue_type, entity_type, entity_id, title, state, source
) VALUES (
  'production_queue',
  'order',
  '00000000-0000-4000-8000-0000000000aa',
  'Staging dup test 1',
  'pending',
  'execution_os'
);

INSERT INTO public.operational_queue_items (
  queue_type, entity_type, entity_id, title, state, source
) VALUES (
  'production_queue',
  'order',
  '00000000-0000-4000-8000-0000000000aa',
  'Staging dup test 2',
  'pending',
  'execution_os'
);
-- Second insert expect: unique violation on idx_operational_queue_items_source_entity
```

### 10. Completed item allows new open row (partial index)

```sql
UPDATE public.operational_queue_items
SET state = 'completed', completed_at = now(), version = version + 1
WHERE entity_id = '00000000-0000-4000-8000-0000000000aa'
  AND state = 'pending';

INSERT INTO public.operational_queue_items (
  queue_type, entity_type, entity_id, title, state, source
) VALUES (
  'production_queue',
  'order',
  '00000000-0000-4000-8000-0000000000aa',
  'Staging reopen after complete',
  'pending',
  'execution_os'
);
-- Expect: success (completed row excluded from partial unique index)
```

### 11. RLS read — staff vs non-staff (optional)

Requires two JWT test users in staging:

```sql
-- As internal staff (authenticated): should succeed
SELECT count(*) FROM public.operational_queue_items;

-- As buyer/customer role (if exists): should return 0 rows or permission denied
-- Test via client SDK with that user's session, not service_role SQL editor
```

---

## Repository contract (code review)

Verified in tree:

| Requirement | Location |
|-------------|----------|
| Authority on every queue write | `persistentQueueRepository.ts` → `requireExecutionAuthority` |
| Event per queue mutation | `appendQueueEvent` after create/assign/transition |
| `correlation_id` required | `inMemoryOperationalEventRepository`, `appendQueueEvent` |
| Optimistic version | `updateRow(..., expectedVersion)` |
| Cancel/fail require non-empty reason | `requireTransitionReason` |
| Unknown action denied | `executionAuthorityGuard.ts` |
| No finance/stock/dispatch business actions | `FORBIDDEN_ACTION_PREFIXES` in matrix |

---

## Rebase status

| Step | Status |
|------|--------|
| PR #105 merged to `main` | **Pending** (open at last check) |
| Rebase `cursor/execution-os-phase3a3d-foundation-6c20` onto `main` | **Blocked** until #105 merges |
| Staging migration apply | **Not run** in this agent environment |

After #105 merges:

```bash
git fetch origin main
git checkout cursor/execution-os-phase3a3d-foundation-6c20
git rebase origin/main
# Resolve conflicts only in overlapping paths; do not expand scope
git push --force-with-lease origin cursor/execution-os-phase3a3d-foundation-6c20
```

---

## Sign-off

- [ ] Staging checklist completed
- [ ] Event immutability verified in SQL
- [ ] Partial unique index verified
- [ ] RLS verified for staff vs public
- [ ] CI green on PR #106
- [ ] Bugbot clean

**Do not merge to production** until staging sign-off and #105 on `main`.
