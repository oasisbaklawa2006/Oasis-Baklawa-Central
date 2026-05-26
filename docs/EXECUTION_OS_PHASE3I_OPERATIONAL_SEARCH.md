# Phase 3I — Persistent operational search index

## Mission

Governed internal search across SO/order refs, queues, events, scans, customers, complaints, and dispatch references. No customer public search, no external service, no scheduled indexing.

## Artifacts

| Area | Path |
|------|------|
| Migration | `supabase/migrations/20260526020000_execution_os_phase3i_operational_search_index.sql` |
| Core | `src/lib/operational-search/searchIndex*.ts`, `searchQueryParser.ts`, `searchVisibilityGuard.ts` |
| Repository | `searchIndexRepository.ts`, `supabaseSearchIndexRepository.ts`, `inMemorySearchIndexStore.ts` |
| UI | `/admin/operational-search` → `OperationalGlobalSearch.tsx` |
| Backfill | `searchBackfillPlan.ts` (dry-run contract only) |

## Visibility

- `internal` — staff with `is_internal_staff`
- `staff_scoped` — department/role guard in app layer
- `customer_safe_candidate` — must pass suppression firewall (no public search route in this phase)

## Writes

Only `searchIndexRepository` / `supabaseSearchIndexRepository` may `.upsert` / `.insert` / `.update` on `operational_search_index`. No DELETE from UI.

## Out of scope

Customer public search, Edge cron indexer, notification triggers, finance/dispatch/stock mutations.
