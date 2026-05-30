# Phase 21 — RLS policies PRE (production)

**Project:** `tcxvcatsqqertcnycuop`  
**Captured:** 2026-05-30 via read-only SQL on `pg_policies`  
**Tables:** `orders`, `order_items`, `companies`, `order_payments`

Use this archive to diff after migration `20260508155100` and `20260515194500`.

---

## companies (3 policies)

| policyname | cmd | roles | qual (summary) |
|------------|-----|-------|----------------|
| Admins manage companies | ALL | authenticated | get_user_role admin/super_admin |
| Buyers see own company, admins see all | SELECT | public | admin roles OR own company_id |
| OASIS_AUTH_INSERT_BYPASS | INSERT | authenticated | true |

---

## order_items (5 policies)

| policyname | cmd | roles |
|------------|-----|-------|
| Buyers delete own order_items | DELETE | authenticated |
| Buyers insert own order_items | INSERT | public |
| Buyers read own order_items | SELECT | authenticated |
| Buyers update own order_items | UPDATE | authenticated |
| Staff full access order_items | ALL | authenticated — `is_internal_staff` |

---

## order_payments (6 policies)

| policyname | cmd | roles |
|------------|-----|-------|
| Admins manage payments | ALL | authenticated |
| Buyers insert own company payments | INSERT | authenticated |
| Buyers read own company payments | SELECT | authenticated |
| Staff manage order payments | ALL | authenticated |
| buyer_insert_own_order_payments | INSERT | authenticated |
| buyer_read_own_order_payments | SELECT | authenticated |

---

## orders (15 policies)

| policyname | cmd | roles |
|------------|-----|-------|
| Admins can view and edit all orders | ALL | public |
| Buyers attach payment receipt metadata | UPDATE | authenticated |
| Buyers can view their own company orders | SELECT | public |
| Buyers insert own company orders | INSERT | public |
| Buyers revoke failed receipt ledger sync | UPDATE | authenticated |
| Buyers update own draft orders | UPDATE | authenticated |
| Internal staff can view all orders | SELECT | authenticated |
| Staff can update all orders | UPDATE | authenticated |
| Users can view company orders | SELECT | public |
| buyer_update_submitted_order_receipt | UPDATE | authenticated |
| finance_exec_read_all_orders | SELECT | public |
| finance_exec_update_payment_fields | UPDATE | public |
| operations_view_in_production_orders | SELECT | public |
| ops_manager_read_cleared_orders | SELECT | public |
| sales_exec_read_own_customers | SELECT | public — `account_manager_id` |

**Post-push expectation:** Migration `20260508155100` will DROP many legacy policy names and replace with staff/sales-exec/buyer scoping via `is_internal_staff`, `get_user_role`, `is_account_manager`.

---

## Full row export (machine-readable)

Captured 29 policy rows. Full `qual` / `with_check` text available in Phase 21 audit SQL result set (2026-05-30).
