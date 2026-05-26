# Phase 3B — Staging validation (no new migration)

Phase 3B adds TypeScript service + optional admin preview only. **Requires Phase 3A/3D migration** already applied in staging.

## Preconditions

- [ ] PR #105 merged to `main`
- [ ] PR #106 merged to `main`
- [ ] `supabase/migrations/20260525230000_execution_os_phase3a3d_foundation.sql` applied in staging
- [ ] `docs/EXECUTION_OS_PHASE3A3D_STAGING_VALIDATION.md` signed off

## Rebase

```bash
git fetch origin main
git checkout cursor/phase-3b-operational-queue-actions-6c20
git rebase origin/main
```

## Deploy / build

- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run test -- --run src/lib/operational-execution`

## Functional smoke (staging)

Use a staff JWT with `OPERATIONS_MANAGER` or `SUPER_ADMIN`.

1. **Read:** Confirm `operational_queue_items` has rows (or create one via service/script using `createQueueItem`).
2. **Acknowledge:** `acknowledgeQueueItem` on `pending` item → state `acknowledged`, event `queue_acknowledged`.
3. **Assign → start → complete:** Happy path; verify `operational_events` rows append-only (no UPDATE success).
4. **Block:** Requires reason; state `blocked`; event `queue_blocked`.
5. **Cancel:** Requires reason + `SUPER_ADMIN` (ADMIN denied).
6. **Stale version:** Second writer with old `expectedVersion` → error, no silent merge.

## UI preview (optional)

- [ ] Route `/admin/queue-execution-preview` loads for `cmd_war_room` roles
- [ ] Non–write roles see list/read-only message
- [ ] `SUPER_ADMIN` / `OPERATIONS_MANAGER` can run preview buttons; network tab shows no direct `operational_queue_items` PATCH from UI (service uses repository)

## RLS regression

No schema change — re-run immutability checks from Phase 3A/3D doc on `operational_events`.

## Sign-off

| Gate | Owner | Date |
|------|-------|------|
| 3A/3D migration | | |
| 3B service smoke | | |
| Preview UI (if enabled) | | |
