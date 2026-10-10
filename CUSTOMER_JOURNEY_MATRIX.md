# CUSTOMER JOURNEY MATRIX

**Scope:** Journey A — B2B access request → application → approval → login/OTP → dashboard → catalogue → cart → checkout/SO → payment/production/QC/invoice visibility → documents/statement → reorder → support → closure.
**Repos:** `oasisbaklawa2006/oasis-supabase-core`, `oasisbaklawa2006/oasis-baklawa` (Buyer app), `oasisbaklawa2006/Oasis-Baklawa-Central` (staff approval side). All `main`.
**Cross-reference:** Buyer repo ships its own `docs/auth01-rpc-security-matrix.md`; every row independently checked against actual migration bodies in this pass was found accurate.
**Note on migration resequencing:** Several migration files named in the original brief are now empty "historical compatibility stub[s]" — the live implementation moved to a later-dated file with the same feature. Each such redirect is noted explicitly below; the **live** file is what's cited.

---

## 1. B2B Access Request (pre-login intake)

| Field | Evidence |
|---|---|
| RPC | `submit_b2b_access_request_v2` — `20260910040000_b2b_prelogin_access_lifecycle.sql`. SECURITY DEFINER, `GRANT EXECUTE TO anon, authenticated, service_role` (deliberately anon-callable) |
| Validation | business_name/contact_name/email/phone/consent; dedups on (normalized email, normalized mobile) — repeat submission returns existing row (`duplicate:true`) |
| Table lockdown | `REVOKE INSERT ON b2b_applications FROM public, anon, authenticated` in same migration — RPC is the only intake surface |
| Calling UI | `src/screens/RegisterScreen.tsx` (Buyer), `src/lib/api/buyer.ts` → `callRpc("submit_b2b_access_request_v2", ...)`, enforced in `src/lib/buyer-deployment-rpc-allowlist.ts` |
| DB state | New `b2b_applications` row, `status='pending'`, `resolved_company_id`/`user_id` NULL |
| Notification | None triggered by this RPC (notification fires only on approval, see step 4) |
| Idempotency | **PROVEN** — email+mobile natural-key dedup with unique_violation fallback |
| **Classification** | **PROVEN** |

## 2. Staff Approval / Rejection (Central)

| Field | Evidence |
|---|---|
| Approve RPC | `approve_b2b_access_request_v2` — current body in `20260914123000_auth01_b2b_approval_mobile_identity_stability.sql` (supersedes `20260910040000`/`20260914060000`). Staff-only via `is_internal_staff()` re-checked under `FOR UPDATE` (serializes against concurrent revocation). Requires non-blank price tier. Two paths depending on whether application already has a `user_id`; idempotent on already-approved rows; writes `audit_logs` |
| Reject RPC | `reject_b2b_trade_application_v1` — `20260807060000_b2b_trade_application_registration_and_approval_v1.sql`. Staff-only, non-blank reason required, idempotent on already-rejected rows |
| Calling UI | `Oasis-Baklawa-Central/src/pages/admin/AdminClients.tsx` — `handleApprove()`/`handleReject()`. **This is the screen the prior #462 UAT audit flagged** (Select-in-Sheet z-index; KPI/count desync) |
| Re-check on known #462 defects | Select-in-Sheet: current code still renders `<Select>` inside `<Sheet>` with no visible z-index override — **consistent with, not proof of, the prior finding; not reproduced live (physical UAT territory)**. KPI desync: current code calls `refreshAfterPipelineMutation()` after every mutation, re-fetching counts from backend truth (`fetchClientGovernanceCounts()`) rather than local increment — **consistent with a fix, not diff-verified against pre-#462 code, so not independently certified as fixed** |
| RBAC | Enforced at the RPC (`is_internal_staff`), not just UI |
| **Classification** | **PROVEN** for RPC/DB chain; **PARTIALLY PROVEN** for "no recurrence" of the two known UI defects |

## 3. First Login / Phone-OTP / Session Resolution / Identity Claim

| Field | Evidence |
|---|---|
| RPC | `claim_approved_b2b_access_request_v2` — current body in `20260914160000_auth01_verified_identifier_membership_compat.sql`. Reads `auth.users.phone/phone_confirmed_at/email/email_confirmed_at` for `auth.uid()` — trusts only Supabase-Auth-confirmed identifiers. Excludes staff. Fails closed on ambiguous match (`AMBIGUOUS_APPROVED_APPLICATION`). Handles legacy split-identity without stealing `user_id`; rejects `IDENTITY_COMPANY_CONFLICT` if bound to a different company. Activates company/role/profile |
| OTP mechanics | **NOT verified** — `supabase/functions/msg91-session-bridge/` exists but was not opened; the DB-side consumer of a confirmed phone is hardened, but OTP send/verify/retry is **CREDENTIAL-GATED / UNPROVEN** |
| Calling UI | `src/lib/buyer-identity-claim.ts` / `buyer-identity-claim-core.ts` confirmed calling the RPC; screens `LoginScreen.tsx`, `SessionRecoveryScreen.tsx`, `AccessPendingScreen.tsx`, `AccessRejectedScreen.tsx`, `OnboardingScreen.tsx` matched by name to lifecycle states but not individually opened |
| **Classification** | DB-side claim RPC: **PROVEN**. OTP mechanics + exact screen wiring: **CREDENTIAL-GATED / PARTIALLY PROVEN** |

## 4. Notification on Approval

| Field | Evidence |
|---|---|
| Edge Function | `supabase/functions/notify-event/index.ts`. For `approval_granted`, requires internal-staff or service_role caller; builds notification server-side only from `b2b_applications` fields (rejects caller-supplied subject/message) |
| Delivery | `notification_outbox` with idempotency key, claim/lease pattern (120s lease, "quarantined" state for ambiguous completions), dual-channel: email (Resend), WhatsApp (Click2API → MSG91 fallback) |
| Calling UI | `AdminClients.tsx handleApprove()` calls `notifyEvent(...)` after the approval RPC commits; failure is toast-only, does not roll back approval (correct — approval is source of truth) |
| Idempotency | Payload mismatch on retry raises `approval_notification_idempotency_conflict` (409) rather than resending a different message |
| Automatic order/ticket-event WhatsApp notification | **UNPROVEN / NOT FOUND** — no DB trigger or automatic call to `notify-event` found on order-status or ticket-creation transitions; every call found is UI-initiated (staff button press). Large unread WhatsApp subsystem (~60 migrations) remains, so treat as not-yet-located, not confirmed absent |
| **Classification** | Approval notification chain: **PROVEN**. Automatic order/ticket WhatsApp notification: **UNPROVEN** |

## 5. Dashboard / Catalogue / Filters / Product Detail / MOQ

| Field | Evidence |
|---|---|
| RPCs | `published_products_v1()` (anon-safe, no pricing) — live body in squashed baseline `20260723161256_legacy_role_authority_baseline.sql` (the brief's `20260721191444` file is an empty stub). `buyer_product_prices_v1()` — hardened in `20260918010000_auth01_buyer_rpc_identity_gate_hardening.sql` |
| Company gate | `customer_buyer_eligible_company_id()` — resolves strictly via `profiles.id=auth.uid()` + approved + role + not-staff + company active |
| MOQ enforcement | `customer_validate_order_quantity_v1()` is **INTERNAL ONLY** (revoked from client roles, `service_role` only) and is called from inside the mutating RPCs — client cannot bypass MOQ/increment/carton rules by calling a client-reachable RPC directly |
| Calling UI | `CatalogueScreen.tsx`, `ProductDetailScreen.tsx`, `DashboardScreen.tsx`, `src/services/customerGateway.ts` |
| **Classification** | **PROVEN** |

## 6. Cart (persistent order draft)

| Field | Evidence |
|---|---|
| RPCs | `get_customer_order_draft_v1`, `add_customer_order_draft_line_v1`, `update_customer_order_draft_line_v1`, `remove_customer_order_draft_line_v1`, `clear_customer_order_draft_v1` — all in `20260807171000_customer_order_draft_v1.sql`, authenticated-only, company resolved server-side (never client-supplied) |
| One-active-draft guard | Partial unique index `uq_customer_order_drafts_one_active_per_company` |
| Mutation lockdown | RLS restricts SELECT to own company; `REVOKE INSERT/UPDATE/DELETE FROM anon, authenticated` on draft/line tables — mutation is RPC-only even against direct PostgREST table access |
| Calling UI | `CartScreen.tsx`, `ProductDetailScreen.tsx` (add-line). `QuickOrderScreen.tsx`/`AiOrderScreen.tsx` inferred by name only — **not verified** |
| **Classification** | **PROVEN** for RPC/DB chain + MOQ enforcement; QuickOrder/AiOrder wiring **UNPROVEN** |

## 7. Checkout / SO Generation / 30% Advance

| Field | Evidence |
|---|---|
| RPC | `submit_customer_order_v1(p_idempotency_key, p_requested_dispatch_date)` — `20260807172000_customer_checkout_submit_v1.sql`. Idempotent on `(company_id, idempotency_key)` via unique partial index + advisory xact lock; retried/duplicate submit returns existing order with `is_duplicate_submission=true`; race caught in `EXCEPTION` block and resolved the same way |
| Behavior | Re-validates draft readiness + re-resolves every line's pricing/MOQ at checkout (does not trust the earlier snapshot); inserts `orders`(status='submitted', order_origin='CUSTOMER_APP', immutable `checkout_snapshot`) + `order_items`; marks draft `status='promoted'` |
| Advance formula | `calculate_customer_advance_v1`: pure, 30% rounded **up** to next ₹500 (`ceil`). **Explicitly isolated** from the legacy 50%-advance path via `orders.order_origin` discriminator — `recalculate_erp_order_financials()`/`restore_order_financials()` branch on it, confirmed by reading both function bodies |
| Calling UI | `CheckoutScreen.tsx` (confirmed), `OrderPaymentScreen.tsx` for the advance-payment step |
| RBAC | Same `customer_buyer_eligible_company_id()` gate; fails closed with `BUYER_NOT_ELIGIBLE` |
| **Classification** | **PROVEN**, including the exact 30%-round-up-₹500 rule and its isolation from the legacy 50% formula |

## 8. Payment-State / Production / QC / PI / Final-Invoice / Balance / Dispatch Visibility (buyer read-side)

| Field | Evidence |
|---|---|
| RPCs | `customer_sales_order_commercial_facts_v1()` (list), `customer_order_finance_facts_v1(p_order_id)` (single-order, company-ownership re-checked — the one RPC here taking a client-supplied ID), `customer_proforma_invoice_facts_v1()` (PI number/issued_at hidden until `status='ISSUED'`) — all in `20260901005500_app_e2e_buyer_commercial_projections.sql` (brief's `20260901005100` is an empty stub, resequenced) |
| Documents | `customer_documents_v1()` — `20260901005600_app_e2e_buyer_documents_favourites_queries.sql` (brief's `20260901005200` is an empty stub). Unions SO/PI/Final-Invoice into one feed with `availability_state`; final-invoice number/total NULL until ISSUED |
| Statement | `customer_statement_v1()` composes from `get_customer_financial_360_v1()` — **not independently opened** |
| Balance/final payment | `get_sales_order_pi_final_payment_request_v1` — cited from the Buyer security matrix only, **not independently read**; source migration `20260902083000_final_payment_pi_revision_authority.sql` |
| Production-stage/QC/delay visibility | **No dedicated buyer-facing RPC found** exposing production milestones, QC pass/fail, or a delay reason. `customer_order_status_v1()` (hardened `20260918010000`) maps internal status into a **coarse 7-value `customer_stage` enum** (order_received/payment_pending/in_production/packing/ready_for_dispatch/dispatched/processing) + tracking_number/courier_name (populated only once dispatched). The extensive Core production/RGS/dispatch/QC subsystem (~15+ migrations) was **not traced** for whether any of it projects further detail to the Buyer app |
| Calling UI | `customerGateway.ts` → `commercialFacts()`, `financeFacts()`, `proformaInvoices()`, `documents()`, `statement()`, `finalPaymentRequest()`; screens `OrderDetailScreen.tsx`, `OrderPaymentScreen.tsx`, `DocumentsScreen.tsx`, `OrdersScreen.tsx` |
| **Classification** | Commercial/finance/PI/final-invoice/documents/statement: **PROVEN**. Production-stage/QC/delay-reason detail: **UNPROVEN** (searched, not found — coarse status only). Final/balance-payment RPC: **PARTIALLY PROVEN** (matrix-sourced, not independently read) |

## 9. Support Ticket / Complaint (submission)

See `SUPPORT_JOURNEY_MATRIX.md` for the full downstream trace. Submission-side summary:

| Field | Evidence |
|---|---|
| RPC | `submit_customer_support_ticket_v2(p_idempotency_key, ...)` — `20260917170000_support_ticket_idempotency_v2.sql`, advisory-lock dedup on `(company_id, created_by, idempotency_key)`, explicit payload-mismatch-on-same-key raises `P0001` (a documented bugfix over silently swallowing via 23505). v1 (`submit_customer_support_ticket_v1`, hardened in `20260918010000` to check order ownership) remains deployed for backward compatibility |
| Calling UI | `customerGateway.ts → submitTicket()` calls **v2 exclusively**; `SupportScreen.tsx` |
| Read-side | `customer_support_tickets_v1()` maps to a buyer-safe derived status; internal fields (routed_to_department, assigned_employee_id, ai_rewritten_reply) stripped |
| **Classification** | Submission: **PROVEN**, including the documented idempotency fix. Resolution/communication/closure: see SUPPORT_JOURNEY_MATRIX.md — **BROKEN/UNPROVEN in multiple places** |

## 10. Favourites / General Query / Reorder

| Field | Evidence |
|---|---|
| RPCs | `set_customer_product_favourite_v1`/`customer_product_favourites_v1`, `submit_customer_general_query_v1`/`customer_general_queries_v1` — `20260901005600_app_e2e_buyer_documents_favourites_queries.sql` |
| Favourite idempotency | PROVEN — `ON CONFLICT DO NOTHING` / unconditional DELETE |
| **DEFECT** | `submit_customer_general_query_v1`'s idempotency-conflict path uses `unique_violation` (23505) inside its own `exception when unique_violation` handler — a payload-mismatched retry under the same key is **silently swallowed as a duplicate-replay rather than surfaced as a conflict**. This is the exact failure mode `20260917170000`'s own header documents fixing for tickets (which now raises `P0001` explicitly), but the fix was **not applied** to this RPC. Not run to confirm the swallow occurs live — flagged as a candidate defect on read evidence. See JOURNEY_FAILURE_LEDGER FL-CUST-01 |
| General query scope | Explicitly designed to never create an order (`customer_general_queries` table comment) |
| Reorder | **No dedicated `reorder_*` RPC found** anywhere in migrations read or via code search. If implemented, most likely client-side (read past order → call `add_customer_order_draft_line_v1` per line, which would still be safely re-validated) — but no such screen wiring was located |
| **Classification** | Favourites/general-query submission: **PROVEN**, with **one BROKEN candidate** (general-query idempotency swallow). Reorder: **UNPROVEN** |

---

## NOT INVESTIGATED THIS PASS

- Detailed RGS/3PGS/dispatch/production Core migrations (~20+ files) — whether any project further detail to the Buyer app beyond the 7-state `customer_stage` enum.
- `msg91-session-bridge` Edge Function body (OTP mechanics) — CREDENTIAL-GATED regardless, would need a live MSG91 sandbox.
- Central staff-side ticket resolution/communication screens (see SUPPORT_JOURNEY_MATRIX.md for what was found there).
- `get_customer_financial_360_v1`, `get_order_payment_facts_v1`, `get_sales_order_pi_final_payment_request_v1` bodies — referenced/composed-into, not independently opened.
- Buyer screens: `AiOrderScreen.tsx`, `QuickOrderScreen.tsx`, `QuotationDetailScreen.tsx`, `QuotationsScreen.tsx`, `AccountScreen.tsx`, `WelcomeScreen.tsx`, `SplashScreen.tsx` — names only.
- Whether any DB trigger fires WhatsApp notifications automatically on order/ticket status change — searched, not found, large subsystem not exhaustively read.
