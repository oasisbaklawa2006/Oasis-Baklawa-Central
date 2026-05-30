# PHASE 20 — Migration risk audit report (19 pending production migrations)

**Production project:** `tcxvcatsqqertcnycuop`  
**Audit date:** 2026-05-30  
**Method:** Line-by-line review of `supabase/migrations/` files (read-only). No `db push`, no production writes, no code changes.  
**App SHA (deployed):** `189177dfd70407ac02b042cd11a7a5f24f846e44`

---

## Executive summary

| Metric | Result |
|--------|--------|
| Migrations reviewed | **19 / 19** |
| Destructive (`DROP TABLE`, `TRUNCATE`, column drops) | **0** |
| Data-transforming (`UPDATE`/`DELETE` on business rows) | **0** |
| **High-risk** migrations | **1** (`20260508155100`) |
| **Medium-risk** migrations | **3** (`20260515194500`, `20260518220000`, `20260508155100` counted as high) |
| **Hard blockers** (must not push) | **0** |
| **Conditional gates** (pre-push verify) | **3** |
| **GO / NO-GO for `db push`** | **GO with conditions** |

---

## 1. Pending migrations in exact execution order

| # | Version | File |
|---|---------|------|
| 1 | `20260503201343` | `add_request_info_fields_to_b2b_applications.sql` |
| 2 | `20260503215926` | `add_deleted_at_to_users.sql` |
| 3 | `20260504035656` | `add_message_intent_to_debug_webhooks.sql` |
| 4 | `20260508155100` | `phase4_sales_roster_scope.sql` |
| 5 | `20260510120000` | `phase44_dispatch_proof.sql` |
| 6 | `20260515120000` | `orders_finance_audit.sql` |
| 7 | `20260515120001` | `order_payment_status_on_credit_enum.sql` |
| 8 | `20260515194500` | `buyer_payment_receipt_and_storage.sql` |
| 9 | `20260516200000` | `orders_payment_rejection_reason.sql` |
| 10 | `20260518220000` | `c2a_whatsapp_audit_tables_reconciliation.sql` |
| 11 | `20260525230000` | `execution_os_phase3a3d_foundation.sql` |
| 12 | `20260526010000` | `execution_os_phase3c_barcode_execution.sql` |
| 13 | `20260526020000` | `execution_os_phase3i_operational_search_index.sql` |
| 14 | `20260526030000` | `execution_os_phase4a_inventory_reservation.sql` |
| 15 | `20260526120000` | `execution_os_phase4b_dispatch_readiness.sql` |
| 16 | `20260526130000` | `execution_os_phase4c_finance_governance.sql` |
| 17 | `20260526140000` | `execution_os_phase4d_dispatch_completion.sql` |
| 18 | `20260526150000` | `execution_os_phase4e_dispatch_finalization.sql` |
| 19 | `20260526160000` | `execution_os_phase4g_stock_finalization.sql` |

**Execution OS subset:** rows **11–19** (9 migrations).

---

## 2. Per-migration classification

Legend: **A** additive only · **P** policy-changing · **D** destructive · **T** data-transforming · **L** touches live business tables · **R** touches RLS

| # | Migration | A | P | D | T | L | R | Domains touched |
|---|-----------|---|---|---|---|---|---|-----------------|
| 1 | `20260503201343` | ✓ | | | | `b2b_applications` | | B2B |
| 2 | `20260503215926` | ✓ | | | | `users` | | users |
| 3 | `20260504035656` | ✓ | | | | `debug_webhooks` | | WhatsApp debug |
| 4 | `20260508155100` | | ✓ | | | `companies`, `orders`, `order_items` | ✓ | orders, companies, users (via RLS) |
| 5 | `20260510120000` | ✓ | | | | `dispatches` | | dispatch |
| 6 | `20260515120000` | ✓ | | | | `orders` | | orders, payments (cols) |
| 7 | `20260515120001` | ✓ | | | | enum `order_payment_status` | | payments |
| 8 | `20260515194500` | ✓ | ✓ | | | `orders`, `order_payments` | ✓ | orders, payments, storage |
| 9 | `20260516200000` | ✓ | | | | `orders` | | orders, payments |
| 10 | `20260518220000` | ✓ | ✓ | | | `whatsapp_*` (exist on prod) | ✓ | WhatsApp |
| 11 | `20260525230000` | ✓ | ✓ | | | **new** queue/event tables | ✓ | inventory OS foundation |
| 12 | `20260526010000` | ✓ | ✓ | | | **new** `operational_scan_records` | ✓ | scans |
| 13 | `20260526020000` | ✓ | ✓ | | | **new** search index | ✓ | search |
| 14 | `20260526030000` | ✓ | ✓ | | | **new** reservation/movement | ✓ | inventory |
| 15 | `20260526120000` | ✓ | ✓ | | | **new** readiness evidence | ✓ | dispatch |
| 16 | `20260526130000` | ✓ | ✓ | | | **new** finance evidence | ✓ | finance |
| 17 | `20260526140000` | ✓ | ✓ | | | **new** completion evidence | ✓ | dispatch |
| 18 | `20260526150000` | ✓ | ✓ | | | **new** release lineage | ✓ | dispatch |
| 19 | `20260526160000` | ✓ | ✓ | | | **new** balances/lineage; ALTER `inventory_movements` CHECK | ✓ | inventory |

---

## 3. Deep review: `20260508155100_phase4_sales_roster_scope.sql`

| Aspect | Finding |
|--------|---------|
| **Purpose** | Sales-executive roster scoping: staff vs `SALES_EXECUTIVE` vs buyer access on `companies`, `orders`, `order_items` |
| **DDL** | `ENABLE ROW LEVEL SECURITY` on all three tables; **DROP POLICY IF EXISTS** (many legacy names); **CREATE POLICY** replacements |
| **Destructive?** | No table/column drops |
| **Data transform?** | No DML |
| **Dependencies** | `public.is_internal_staff`, `public.get_user_role`, `public.is_account_manager` — **`is_account_manager` exists on production** (migration `20260328155611` already applied) |
| **Risk** | **HIGH** — any mismatch between current production policies and this file changes **who can SELECT/INSERT/UPDATE/DELETE** orders immediately after step 4 |
| **Sales executive** | Scoped to `is_account_manager` — cannot read all orders |
| **Staff** | Broad update/insert/delete on orders (non–sales-exec) |
| **Buyers** | Draft update + insert scoped to own `company_id` |
| **Lock** | Brief policy catalog churn; possible denied access if `is_internal_staff` false for expected admins |
| **Mitigation** | Off-peak window; war room; post-push smoke login as staff + buyer + sales exec; pre-push read-only: `SELECT relrowsecurity FROM pg_class WHERE relname IN ('orders','companies','order_items')` and `SELECT policyname FROM pg_policies WHERE tablename='orders'` |

**Verdict:** **Can proceed YES** — not a blocker — with **mandatory** post-push auth smoke and pre-flight policy snapshot.

---

## 4. Risk table (all 19)

| Migration file | Objects touched | Risk | Expected production impact | Rollback difficulty | Proceed? |
|----------------|-----------------|------|---------------------------|---------------------|----------|
| `20260503201343_...` | `b2b_applications` +2 cols | **Low** | Nullable cols; no behavior change until app uses them | Easy (drop cols) | **Yes** |
| `20260503215926_...` | `users.deleted_at` | **Low** | Nullable; existing rows unchanged | Easy | **Yes** |
| `20260504035656_...` | `debug_webhooks.message_intent` | **Low** | Nullable; WhatsApp classifier only | Easy | **Yes** |
| `20260508155100_...` | `companies`, `orders`, `order_items` RLS policies | **High** | Access pattern change for staff/buyers/sales exec | Hard (policy restore) | **Yes*** |
| `20260510120000_...` | `dispatches` +2 cols | **Low** | Default `is_partial=false`; proof path nullable | Easy | **Yes** |
| `20260515120000_...` | `orders` finance cols + indexes | **Low** | `IF NOT EXISTS` — cols likely **already present** on prod | Easy | **Yes** |
| `20260515120001_...` | enum `order_payment_status` | **Low** | Adds `on_credit` if type exists; no-op else | N/A enum | **Yes** |
| `20260515194500_...` | `order_payments` cols; `storage.buckets`; storage + orders RLS | **Medium** | Buyer receipt flow; **public SELECT** on `receipts` bucket objects | Medium | **Yes*** |
| `20260516200000_...` | `orders.payment_rejection_reason` | **Low** | `IF NOT EXISTS` — likely **already present** | Easy | **Yes** |
| `20260518220000_...` | `whatsapp_override_log`, `whatsapp_suggestions_log`, FKs, RLS | **Medium** | Tables **exist**; policies **replaced**; FKs added if no orphans | Medium | **Yes*** |
| `20260525230000_...` | `operational_queue_*`, `operational_events` + RLS + triggers | **Low** | New empty tables | Drop tables (if no data) | **Yes** |
| `20260526010000_...` | `operational_scan_records` + RLS + triggers | **Low** | New empty table | Drop | **Yes** |
| `20260526020000_...` | `operational_search_index` + GIN indexes + RLS | **Low–Med** | New empty table; GIN build cheap when empty | Drop | **Yes** |
| `20260526030000_...` | `inventory_reservations`, allocations, `inventory_movements` | **Low** | New empty governed inventory layer | Drop (ordered) | **Yes** |
| `20260526120000_...` | `dispatch_readiness_evidence` | **Low** | New empty 4B table | Drop | **Yes** |
| `20260526130000_...` | `finance_review_evidence` | **Low** | New empty 4C table | Drop | **Yes** |
| `20260526140000_...` | `dispatch_completion_evidence` | **Low** | New empty 4D table | Drop | **Yes** |
| `20260526150000_...` | `dispatch_release_lineage` | **Low** | New empty 4E table | Drop | **Yes** |
| `20260526160000_...` | `inventory_stock_balances`, `stock_consumption_lineage`; CHECK on movements | **Low** | New tables; CHECK on **empty** `inventory_movements` | Drop + restore CHECK | **Yes** |

\*Proceed with **conditional pre-flight / post-push checks** in §5.

---

## 5. Blockers and conditional gates

### 5.1 Hard blockers (do not `db push`)

**None identified** in migration SQL (no destructive DDL, no bulk DML, no ordering violation within single transaction per migration file).

### 5.2 Conditional gates (required before / immediately after push)

| ID | Gate | How to verify (read-only) | Owner |
|----|------|---------------------------|-------|
| C1 | `is_account_manager` exists | `SELECT proname FROM pg_proc WHERE proname = 'is_account_manager'` | Eng |
| C2 | `is_internal_staff`, `get_user_role` exist | Phase 15.1 already **PASS** | Eng |
| C3 | Snapshot current `orders` RLS policies | `SELECT * FROM pg_policies WHERE tablename = 'orders'` → archive PRE | DBA |
| C4 | WhatsApp `roles.role_key` has `operations`, `finance`, `director` | `SELECT role_key FROM roles WHERE role_key IN (...)` | Eng |
| C5 | `migration list --linked` → 19 local-only, 0 remote-only | CLI | Eng |
| C6 | Backup/PITR before push | Change ticket | DBA |
| C7 | Post-push: staff + buyer login smoke within 15 min of step 4 | Manual | Ops |

**If C4 fails:** migration 10 still runs; WhatsApp audit SELECT/INSERT may deny until roles seeded — **not a push blocker** for Execution OS.

**If C1 fails:** migration 4 **would fail** at policy creation — **would be hard blocker**; production probe shows `is_account_manager` from older migration — **expected PASS**.

---

## 6. High-risk migrations (summary)

| Rank | Migration | Why |
|------|-----------|-----|
| 1 | `20260508155100` | Replaces live **orders/companies/order_items** RLS — immediate auth impact |
| 2 | `20260515194500` | Storage + `order_payments` + buyer **orders** UPDATE policy |
| 3 | `20260518220000` | Policy swap on **existing** WhatsApp audit tables |

**Execution OS (11–19):** collectively required; individually **low operational risk** (greenfield empty tables). Failure modes are apply-order / reprobe, not business data loss.

---

## 7. GO / NO-GO for production `db push`

| Decision | |
|----------|--|
| **Technical safety of migration SQL** | **GO** |
| **Business safety without window / backup / smoke** | **NO-GO** |
| **Overall** | **GO WITH CONDITIONS** |

**Conditions (all required):**

1. Phase 19 approval signatures (Eng lead + DBA + Ops).  
2. PITR/backup immediately before push.  
3. Off-peak change window (≥2h).  
4. Pre-archived `pg_policies` for `orders` (C3).  
5. Post-push reprobe G1–G8 + auth smoke (C7).  
6. STOP rules from `PHASE_19_PRODUCTION_MIGRATION_APPROVAL.md`.

**Not a reason to delay push:** Execution OS tables missing (that is why push is needed).

---

## 8. PHASE 21 — Execution approval (no blockers)

Use when §7 conditions are met. This is the **authorization to run** `db push` only.

### 8.1 Backup required

- PITR or full snapshot on `tcxvcatsqqertcnycuop` **immediately before** `db push`  
- Backup ID on change ticket: _______________

### 8.2 Command sequence

```bash
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop
npx supabase@latest migration list --linked   # PRE archive
npx supabase@latest db push
npx supabase@latest migration list --linked   # POST archive
```

Repo: `189177dfd70407ac02b042cd11a7a5f24f846e44`

### 8.3 Stop conditions

- `db push` non-zero exit  
- POST list missing any of 19 versions  
- Reprobe G1/G3/G8 fail  
- Mass RLS/login failure after migration 4  
- `migration repair` or manual DDL attempted  

### 8.4 Post-push reprobe

`PHASE_15_5_PRODUCTION_REPROBE.md` gates **G1–G8** + UI smoke six boards.

### 8.5 First single-order pilot rule

**After migration GO only:**

1. Register **one** order in `PILOT_ORDER_TEST_MATRIX.md`.  
2. Complete route containment sign-off (`PHASE_18_ROUTE_CONTAINMENT_PLAN.md`).  
3. Run golden chain **4B → 4C → 4D → 4E → 4F → 4G** for that order only.  
4. **Do not** start order #2 until order #1 post-SQL PASS (`PHASE_18_PILOT_EXECUTION_PACKAGE.md` §5).  
5. **Do not** use Class A routes (`finance-board`, `finance`) on pilot order.

---

## 9. Exact next action

1. Run **conditional gates C1–C5** (read-only SQL + CLI list) and attach to change ticket.  
2. Obtain **Phase 19** signatures if not already signed.  
3. Schedule window → backup → **`db push`** per §8.  
4. Reprobe → then **single-order** pilot per §8.5.

---

*End of Phase 20 migration risk audit report.*
