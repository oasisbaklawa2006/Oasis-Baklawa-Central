# PHASE 15.5 — Post-deployment validation plan (read-only reprobe)

**Production:** `tcxvcatsqqertcnycuop`  
**When to run:** After controlled migration apply (19 pending versions or approved subset).  
**Rules:** **SELECT / catalog queries only.** No INSERT, UPDATE, DELETE, or `apply_migration`.

---

## 1. Pilot readiness gates (summary)

| Gate | Pass criterion |
|------|----------------|
| G1 | All nine pilot tables exist in `public` |
| G2 | Supporting tables exist (`operational_queue_items`, allocations, search index) |
| G3 | Migration history contains `20260525230000` … `20260526160000` |
| G4 | Immutable trigger functions exist (8) |
| G5 | RLS enabled + policy count ≥ expected minimum |
| G6 | Critical CHECK constraints present (`dispatch_consumption_confirmed`, `consumption_finalized`) |
| G7 | `is_internal_staff`, `get_user_role` still present |
| G8 | No accidental row loss on `orders` / `order_status_history` (count stable vs pre-deploy snapshot) |

**Pilot GO:** G1–G8 all pass + human sign-off on `PRODUCTION_PILOT_CHECKLIST.md`.

---

## 2. Table existence

```sql
-- G1: Pilot tables
SELECT table_name,
       CASE WHEN table_name IS NOT NULL THEN 'OK' ELSE 'MISSING' END AS status
FROM (VALUES
  ('operational_scan_records'),
  ('inventory_reservations'),
  ('inventory_movements'),
  ('dispatch_readiness_evidence'),
  ('finance_review_evidence'),
  ('dispatch_completion_evidence'),
  ('dispatch_release_lineage'),
  ('inventory_stock_balances'),
  ('stock_consumption_lineage'),
  ('order_status_history')
) AS required(table_name)
LEFT JOIN information_schema.tables t
  ON t.table_schema = 'public'
 AND t.table_name = required.table_name
ORDER BY required.table_name;
```

```sql
-- G2: Supporting tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'operational_queue_items',
    'operational_queue_assignments',
    'operational_events',
    'inventory_reservation_allocations',
    'operational_search_index'
  )
ORDER BY 1;
-- Expect 5 rows
```

---

## 3. Migration history

```sql
-- G3: Execution OS versions recorded
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version >= '20260525230000'
ORDER BY version;
-- Expect 9 rows (20260525230000 through 20260526160000)
```

```sql
-- Optional: full pending closure (if full db push)
SELECT version
FROM supabase_migrations.schema_migrations
WHERE version >= '20260503201343'
ORDER BY version;
-- Expect 19 new rows if full push from Phase 15.3 baseline
```

---

## 4. Column / constraint verification

```sql
-- G6a: inventory_movements.movement_type allows dispatch consumption
SELECT pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.inventory_movements'::regclass
  AND conname = 'inventory_movements_type_check';
-- def must contain dispatch_consumption_confirmed
```

```sql
-- G6b: stock_consumption_lineage.lineage_type
SELECT pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.stock_consumption_lineage'::regclass
  AND conname = 'stock_consumption_lineage_type_check';
-- def must contain consumption_finalized
```

```sql
-- Reservation columns (4A)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'inventory_reservations'
  AND column_name IN (
    'reservation_status', 'reserved_qty', 'fulfilled_qty',
    'requested_qty', 'reservation_number', 'correlation_id'
  )
ORDER BY 1;
```

```sql
-- dispatch_release_lineage status fields (4E)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'dispatch_release_lineage'
  AND column_name IN (
    'release_type', 'previous_status', 'next_status', 'correlation_id'
  )
ORDER BY 1;
```

```sql
-- Evidence CHECK tables (4B–4D)
SELECT tc.table_name, tc.constraint_name
FROM information_schema.table_constraints tc
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
    'dispatch_readiness_evidence',
    'finance_review_evidence',
    'dispatch_completion_evidence'
  )
  AND tc.constraint_type = 'CHECK'
ORDER BY 1, 2;
```

---

## 5. Index verification

```sql
-- Index count by pilot table (expect >= repo minimums)
SELECT t.relname AS table_name,
       count(*) AS index_count
FROM pg_class t
JOIN pg_namespace n ON n.oid = t.relnamespace
JOIN pg_index i ON i.indrelid = t.oid
WHERE n.nspname = 'public'
  AND t.relname IN (
    'operational_scan_records',
    'inventory_reservations',
    'inventory_movements',
    'dispatch_readiness_evidence',
    'finance_review_evidence',
    'dispatch_completion_evidence',
    'dispatch_release_lineage',
    'inventory_stock_balances',
    'stock_consumption_lineage',
    'operational_queue_items',
    'operational_search_index'
  )
  AND t.relkind = 'r'
GROUP BY t.relname
ORDER BY 1;
```

```sql
-- Spot-check: idempotency unique on operational_events
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'operational_events'
  AND indexname = 'idx_operational_events_idempotency_key';
```

```sql
-- Spot-check: GIN on search index
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'operational_search_index'
  AND indexdef ILIKE '%gin%';
-- Expect at least one GIN index
```

---

## 6. RLS verification

```sql
-- G5: RLS enabled
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'operational_queue_items',
    'operational_scan_records',
    'inventory_reservations',
    'inventory_movements',
    'dispatch_readiness_evidence',
    'finance_review_evidence',
    'dispatch_completion_evidence',
    'dispatch_release_lineage',
    'inventory_stock_balances',
    'stock_consumption_lineage',
    'operational_search_index'
  )
ORDER BY 1;
-- rls_enabled must be true for all
```

```sql
-- Policy counts
SELECT schemaname, tablename, count(*) AS policy_count
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'operational_queue_items',
    'operational_scan_records',
    'inventory_reservations',
    'inventory_movements',
    'dispatch_readiness_evidence',
    'finance_review_evidence',
    'dispatch_completion_evidence',
    'dispatch_release_lineage',
    'inventory_stock_balances',
    'stock_consumption_lineage'
  )
GROUP BY schemaname, tablename
ORDER BY tablename;
```

**Minimum expected policies (approximate):**

| Table | Min policies |
|-------|-------------:|
| `operational_queue_items` | 3 |
| `operational_scan_records` | 2 |
| `inventory_reservations` | 3 |
| `inventory_movements` | 2 |
| `dispatch_readiness_evidence` | 2 |
| `finance_review_evidence` | 2 |
| `dispatch_completion_evidence` | 2 |
| `dispatch_release_lineage` | 2 |
| `inventory_stock_balances` | 3 |
| `stock_consumption_lineage` | 2 |

---

## 7. Trigger / function verification

```sql
-- G4 + G7: Required functions
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname IN (
    'is_internal_staff',
    'get_user_role',
    'prevent_operational_event_mutation',
    'prevent_operational_scan_mutation',
    'prevent_inventory_movement_mutation',
    'dispatch_readiness_evidence_immutable',
    'finance_review_evidence_immutable',
    'dispatch_completion_evidence_immutable',
    'dispatch_release_lineage_immutable',
    'prevent_stock_consumption_lineage_mutation'
  )
ORDER BY 1;
-- Expect 10 rows
```

```sql
-- Triggers on append-only tables
SELECT c.relname AS table_name, t.tgname AS trigger_name
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND c.relname IN (
    'operational_events',
    'operational_scan_records',
    'inventory_movements',
    'dispatch_readiness_evidence',
    'finance_review_evidence',
    'dispatch_completion_evidence',
    'dispatch_release_lineage',
    'stock_consumption_lineage'
  )
ORDER BY 1, 2;
-- Expect 2 triggers per table (no_update, no_delete) for evidence/ledger tables
```

```sql
-- Negative test template (run only in isolated session / rollback — optional)
-- UPDATE public.operational_scan_records SET barcode_value = 'x' WHERE false;
-- Expected: ERROR append-only
```

---

## 8. Data safety (pre/post snapshot)

Capture **before** deploy and compare **after**:

```sql
SELECT 'orders' AS tbl, count(*) FROM public.orders
UNION ALL
SELECT 'order_status_history', count(*) FROM public.order_status_history;
```

**G8 pass:** Counts unchanged unless a separate approved data migration ran.

---

## 9. Application smoke (non-SQL, post-reprobe)

After SQL gates pass:

1. Admin login (`SUPER_ADMIN` in staff map).
2. Open reservation governance board — no “persistence unavailable”.
3. `probeStockFinalizationTables` / reservation probe endpoints return OK.
4. **Do not** run full golden-chain pilot until checklist owner signs `PRODUCTION_PILOT_CHECKLIST.md`.

---

## 10. Failure routing

| Failure | Action |
|---------|--------|
| Table missing | Verify migration history row; do not re-run DDL blindly |
| CHECK missing | Confirm 4G applied after 4A |
| RLS blocks insert | Verify `user_role_map` / staff flags for pilot admin |
| Policy count low | Compare `pg_policies` to repo migration file |
| Trigger missing | Re-apply single migration file only under DBA plan |

---

*End of Phase 15.5 reprobe plan.*
