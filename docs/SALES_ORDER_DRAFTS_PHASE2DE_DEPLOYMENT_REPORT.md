# Sales Order Drafts Phase 2D/2E — Deployment Report

**Migration:** `supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql`  
**Production project:** `tcxvcatsqqertcnycuop` (`oasis-baklawa`)  
**Prepared:** 2026-06-24  
**Status:** NOT APPLIED — migration recovered and committed in this branch

---

## 1. File location audit

| Search target | Result |
|---------------|--------|
| `supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql` on `main` | **MISSING** (pre-recovery) |
| All remote branches (`git ls-tree` across 204 branches) | **MISSING** |
| Full git history (`git log -S`) | **MISSING** — never committed before this branch |
| GitHub code search (`20260623200000`, `phase2de`, `sales_order_drafts_phase`) | **0 hits** |
| Supabase `schema_migrations` version `20260623200000` | **0 rows** |
| Remote table `sales_order_draft_promotion_lineage` | **absent** |
| Remote RPC `promote_sales_order_draft_to_order_atomic` | **absent** |

**Exact file path (recovered):**

```
supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql
```

---

## 2. PR #58 cross-reference

GitHub **PR #58** — *Add WhatsAppInbox UI for stitched packet conversations* (`cursor/whatsapp-inbox-component-e26c`, merged 2026-05-18) — contains **no** reference to `20260623200000_sales_order_drafts_phase2de.sql` in its body, files, or review comments.

| PR #58 artifact | Contains phase2de migration? |
|-----------------|------------------------------|
| `src/components/WhatsAppInbox.tsx` | No |
| `src/pages/OperatorInbox.tsx` | No |
| `supabase/migrations/*` | No migration files |

The missing migration is a **downstream Sprint 9 stitching gap** documented in `docs/BACKEND_REALITY_AUDIT.md` (item 2: `APPROVED_FOR_SO` → `orders` atomic promotion RPC), not part of PR #58's merged diff. Apply this migration **after** WA Sprint 9 draft foundation migrations (`20260605120000`–`20260606180000`).

---

## 3. Scope summary

| Phase | Deliverable | Type |
|-------|-------------|------|
| **2D** | `promote_sales_order_draft_to_order_atomic` | SECURITY DEFINER RPC |
| **2E** | `sales_order_draft_promotion_lineage` | Append-only table + immutability triggers |
| **2E** | `v_sales_order_draft_promotion_queue` | Observability view (approved, not yet promoted) |
| **2E** | `v_sales_order_draft_promotion_history` | Observability view (lineage + order join) |

### Promotion contract (Phase 2D)

- **Precondition:** `status = 'APPROVED_FOR_SO'`, `company_id IS NOT NULL`, readiness re-validated via `validate_sales_order_draft_readiness`.
- **Lines:** At least one `sales_order_draft_lines` row with `product_id` and positive `COALESCE(operator_quantity, normalized_quantity, raw_quantity)`.
- **Writes (single transaction):** `orders` insert → `order_items` inserts → `sales_order_drafts.promoted_order_id` update → `sales_order_draft_audit_log` (`PROMOTE`) → `sales_order_draft_promotion_lineage` row.
- **Idempotency:** If `promoted_order_id` already set, returns existing order id and appends `PROMOTE_IDEMPOTENT` audit row (no second order).
- **Auth:** `is_whatsapp_inbox_reader(auth.uid())`, actor id must match `auth.uid()`.

### Observability contract (Phase 2E)

- Lineage table is **append-only** (update/delete blocked by trigger).
- Inbox readers may SELECT/INSERT lineage; service role has full access.
- Queue view surfaces `APPROVED_FOR_SO` drafts with `promoted_order_id IS NULL`.

---

## 4. Dependency chain (must exist before apply)

| # | Migration / object | Remote status (2026-06-24) |
|---|-------------------|----------------------------|
| 1 | `20260604120000` / `is_whatsapp_inbox_reader` | Applied (remote `20260604034227`) |
| 2 | `20260605120000` / `sales_order_drafts` + lines + audit | Applied (remote `20260604092524`+) |
| 3 | `20260606160000` / `validate_sales_order_draft_readiness` | Applied |
| 4 | `20260512160000` / `assign_order_number_on_insert` on `orders` | Applied |
| 5 | `public.orders`, `public.order_items`, `public.products` | Live |

**This migration (`20260623200000`):** NOT applied.

---

## 5. Pre-apply read-only checks

Run in Supabase SQL Editor on `tcxvcatsqqertcnycuop`:

```sql
-- 5.1 Migration not yet applied
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260623200000';
-- Expected: 0 rows

-- 5.2 Upstream draft tables present
SELECT to_regclass('public.sales_order_drafts') IS NOT NULL AS drafts_ok,
       to_regclass('public.sales_order_draft_lines') IS NOT NULL AS lines_ok,
       to_regclass('public.sales_order_draft_audit_log') IS NOT NULL AS audit_ok;
-- Expected: all true

-- 5.3 Readiness validator present
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname = 'validate_sales_order_draft_readiness';
-- Expected: 1 row

-- 5.4 Target objects absent
SELECT to_regclass('public.sales_order_draft_promotion_lineage') IS NOT NULL AS lineage_exists,
       EXISTS (
         SELECT 1 FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND proname = 'promote_sales_order_draft_to_order_atomic'
       ) AS rpc_exists;
-- Expected: lineage_exists = false, rpc_exists = false

-- 5.5 Current promotion queue (informational)
SELECT COUNT(*) AS approved_awaiting_promotion
FROM sales_order_drafts
WHERE status = 'APPROVED_FOR_SO'
  AND promoted_order_id IS NULL;
-- Live run 2026-06-24: 0
```

---

## 6. Apply procedure

1. Merge branch containing `supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql`.
2. Apply via Supabase CLI against staging first:

```bash
supabase link --project-ref tcxvcatsqqertcnycuop
supabase db push
```

Or paste the full migration SQL into the SQL Editor (single transaction recommended).

3. **Do not** apply to production without staging promotion UAT on a test `APPROVED_FOR_SO` draft.

---

## 7. Post-apply verification

```sql
-- 7.1 Migration recorded
SELECT version, name
FROM supabase_migrations.schema_migrations
WHERE version = '20260623200000';
-- Expected: 1 row

-- 7.2 Objects created
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'sales_order_draft_promotion_lineage';
-- Expected: 1 row, rowsecurity = true

SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'promote_sales_order_draft_to_order_atomic',
    'sales_order_draft_promotion_lineage_immutable'
  );
-- Expected: 2 rows

-- 7.3 Views
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name IN (
    'v_sales_order_draft_promotion_queue',
    'v_sales_order_draft_promotion_history'
  );
-- Expected: 2 rows

-- 7.4 Immutability smoke (should ERROR)
-- UPDATE sales_order_draft_promotion_lineage SET line_count = 0 WHERE false;
-- Expected: sales_order_draft_promotion_lineage is append-only

-- 7.5 Queue view readable
SELECT COUNT(*) FROM v_sales_order_draft_promotion_queue;
-- Expected: succeeds (0+ rows)
```

### Functional UAT (staging, inbox reader JWT)

```sql
-- Replace with a real APPROVED_FOR_SO draft id after test approval
SELECT promote_sales_order_draft_to_order_atomic(
  '<draft-uuid>'::uuid,
  auth.uid(),
  'Staging UAT Operator',
  '{"correlationId":"phase2de-uat-001"}'::jsonb
);
```

Verify:

- `sales_order_drafts.promoted_order_id` set
- `orders` + `order_items` rows created
- `sales_order_draft_audit_log` contains `PROMOTE`
- `sales_order_draft_promotion_lineage` contains 1 row
- Second call returns same `order_id` (idempotent)

---

## 8. Rollback (staging only)

```sql
DROP VIEW IF EXISTS public.v_sales_order_draft_promotion_history;
DROP VIEW IF EXISTS public.v_sales_order_draft_promotion_queue;
DROP FUNCTION IF EXISTS public.promote_sales_order_draft_to_order_atomic(uuid, uuid, text, jsonb);
DROP TABLE IF EXISTS public.sales_order_draft_promotion_lineage;
DROP FUNCTION IF EXISTS public.sales_order_draft_promotion_lineage_immutable();
DELETE FROM supabase_migrations.schema_migrations WHERE version = '20260623200000';
```

**Warning:** Rollback after live promotions will orphan `orders` rows unless manually reconciled. Prefer forward-fix.

---

## 9. Frontend / repo follow-ups (out of scope for this migration)

| Item | Status |
|------|--------|
| `src/integrations/supabase/types.ts` — add RPC + lineage types | Pending `supabase gen types` after apply |
| `salesOrderDraftRepository.ts` — wire `promoteSalesOrderDraft` | Not in Sprint 9 (static guard forbids `orders` writes) |
| Operator Inbox UI — "Promote to Sales Order" button | Requires separate UI PR |

---

## 10. Verdict

| Check | Result |
|-------|--------|
| Migration file located in git | **RECOVERED** — was never committed; now at `supabase/migrations/20260623200000_sales_order_drafts_phase2de.sql` |
| PR #58 contains migration | **NO** — UI-only PR; migration is separate stitching work |
| Upstream dependencies on production | **PASS** |
| Migration applied on production | **NO** — apply blocked until merge + staging UAT |
| Production apply recommendation | **CAUTION** — staging UAT required before prod |

*End of deployment report.*
