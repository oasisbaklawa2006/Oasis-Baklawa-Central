# Phase 3C — Staging validation

Apply **after** Phase 3A/3D migration and **with** Phase 3C migration in staging only.

## Preconditions

- [ ] PR #105, #106, #107 merged to `main`
- [ ] `20260525230000_execution_os_phase3a3d_foundation.sql` applied
- [ ] `20260526010000_execution_os_phase3c_barcode_execution.sql` applied
- [ ] Rebase `cursor/phase-3c-barcode-execution-6c20` onto `main`

## Migration apply

```bash
supabase db push   # or project-specific apply flow
```

## Table / index checks

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'operational_scan_records'
ORDER BY ordinal_position;

SELECT indexname FROM pg_indexes
WHERE tablename = 'operational_scan_records';
```

Expect indexes on: `barcode_value`, `order_id`, `queue_item_id`, `verification_status`, `created_at`, `correlation_id`, `idempotency_key`.

## Append-only enforcement

```sql
-- Must fail
UPDATE public.operational_scan_records SET barcode_value = 'tamper' WHERE id = (SELECT id FROM public.operational_scan_records LIMIT 1);
DELETE FROM public.operational_scan_records WHERE id = (SELECT id FROM public.operational_scan_records LIMIT 1);
```

## RLS

- [ ] `authenticated` staff (`is_internal_staff`) can SELECT + INSERT
- [ ] `anon` cannot read scan records
- [ ] No customer-facing policy on `operational_scan_records`

## Duplicate scan SQL

```sql
SELECT barcode_value, entity_type, entity_id, verification_type, count(*) AS n
FROM public.operational_scan_records
WHERE created_at > now() - interval '1 minute'
  AND verification_status = 'duplicate'
GROUP BY 1,2,3,4;
```

## Mismatch SQL

```sql
SELECT id, scan_type, verification_status, mismatch_reason, created_at
FROM public.operational_scan_records
WHERE verification_status IN ('mismatch', 'rejected')
ORDER BY created_at DESC
LIMIT 20;
```

## Gate verification

```sql
SELECT id, metadata->>'gateId' AS gate_id, verification_status
FROM public.operational_scan_records
WHERE scan_type = 'dispatch_gate'
ORDER BY created_at DESC
LIMIT 10;
```

Confirm **no** `dispatch:complete` or stock columns mutated.

## Event linkage

```sql
SELECT e.event_type, e.correlation_id, e.metadata->>'scanId' AS scan_id
FROM public.operational_events e
WHERE e.event_type LIKE 'scan_%' OR e.event_type LIKE 'gate_scan_%' OR e.event_type LIKE 'department_handoff_%'
ORDER BY e.created_at DESC
LIMIT 20;
```

## Idempotency replay

- Insert scan with same `idempotency_key` twice via API — second call returns same scan id, no duplicate row.

## Sign-off

| Gate | Date |
|------|------|
| Migration applied | |
| Immutability | |
| RLS | |
| Service smoke | |
| Preview UI (optional) | |
