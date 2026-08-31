# APP-E2E — Front / Buyer App + App Order Inward Completion Ledger

**Baseline:** Central `origin/main` `a72443582d2228d7efe47f0e206670873c29cb8a` (2026-08-30)  
**Feature branch:** `codex/app-e2e-front-buyer-order-inward`  
**Boundary:** customer-facing Front/Buyer App and App-generated order inward only. Core schema/RPC authority remains in `oasis-supabase-core`; WhatsApp, Finance authority, Factory, Trace, CRM and Factory Gate are out of scope.

## Status legend

- ✅ VERIFIED COMPLETE — current branch code and automated checks prove the software capability; protected production/runtime proof is tracked separately where required.
- 🟨 BUILT — NEEDS HARDENING — implementation exists but is not yet complete/contract-safe.
- 🟧 PARTIAL / UNCONNECTED — some assets exist, but the current customer journey is not wired end to end.
- 🟥 BROKEN — current behavior violates the approved journey or authority boundary.
- ⬜ MISSING — no current-main implementation was found.
- ⛔ BLOCKED — requires an upstream Core gate or owner decision before safe completion.
- ➖ OUT OF THIS WORKSTREAM — intentionally not owned here.

## Current-main baseline reconciled to final branch

The evidence below records the original current-main gap and the resulting state on this final APP-E2E branch. A ✅ status means the Buyer software capability is now implemented and covered by automated checks; it does not by itself assert protected production deployment or authenticated runtime verification.

| Surface / capability | Status | Evidence and remaining work |
|---|---|---|
| Authentication, splash, login, password reset and access request | ✅ VERIFIED COMPLETE | `Splash`, `Login`, `ResetPassword`, `AuthProvider`, role routing and the authenticated `BuyerAccessRequest` form are wired; access requests call `submit_b2b_trade_application_v1`. Approval and protected runtime evidence remain upstream gates. |
| Buyer/customer route tree and mobile shell | ✅ VERIFIED COMPLETE | `src/App.tsx` routes approved buyer roles to `/buyer`; `BuyerApp` provides Home, Catalogue, Product, Cart, Orders, Account and Support routes with responsive navigation. |
| Customer/company context | ✅ VERIFIED COMPLETE | Buyer screens consume Core `customer_company_v1()` and `customer_team_v1()` projections; unresolved approval still remains a governed access decision. |
| Catalogue, categories, search and filters | ✅ VERIFIED COMPLETE | Buyer catalogue reads active/visible products, governed `buyer_product_prices_v1()` pricing, category filters and search; no catalogue authority is duplicated. |
| Product detail and customer-safe pricing | ✅ VERIFIED COMPLETE | Buyer product detail presents approved catalogue metadata and customer-safe Core pricing/MOQ/UOM values. |
| Favourites | ⛔ BLOCKED | No current-main favourite contract/RPC was found in canonical Core; durable cross-device favourites require a Core authority assignment. No shadow table or direct write is being added. |
| Quick buy and reorder | ✅ VERIFIED COMPLETE | Quick buy and reorder reuse governed draft-line RPCs; product availability/MOQ failures remain Core-authoritative. |
| Persistent cart / MOQ / carton validation | ✅ VERIFIED COMPLETE | Buyer cart uses the Core draft RPC family (`get/add/update/remove/clear_customer_order_draft_v1`) and surfaces readiness/MOQ/carton errors without direct table writes. |
| App order submission / order inward | ✅ VERIFIED COMPLETE | Buyer checkout calls idempotent Core `submit_customer_order_v1` with a stable retry key; Core owns authoritative pricing and the 30%-round-up advance. The legacy `CheckoutModal` is explicitly non-authoritative and no longer calculates or writes order/Finance state. |
| Order list, detail, status and tracking presentation | ✅ VERIFIED COMPLETE | Buyer Orders and Order Detail consume Core `customer_order_status_v1()` and `customer_order_items_v1()` projections and expose safe status, payment-stage and dispatch information. |
| SO / PI / invoice / document presentation | ⛔ BLOCKED | Current-main Buyer document screens are absent. Exact customer-safe document contracts and the Core PI production gate must be confirmed before exposing issuance/frozen commercial truth. |
| Wallet / credit / payment presentation | ➖ OUT OF THIS WORKSTREAM | Finance owns authority. Buyer may display only supplied governed facts after the Finance/Core contract is production-verified. |
| Statements | ⛔ BLOCKED | No current Buyer statement surface or verified customer-safe statement contract found; requires Core authority assignment. |
| Profile / company / team | ✅ VERIFIED COMPLETE | Buyer Account consumes Core company/team projections and provides governed sign-out. |
| Support chat / callback | 🟨 BUILT — NEEDS HARDENING | `SupportChat` exists but writes `audit_logs` directly and depends on a hard-coded Edge Function URL; customer-safe governed support contract and retry/error handling need verification. |
| Support tickets and evidence | ✅ VERIFIED COMPLETE | Buyer Support and `SupportTicketModal` call Core `submit_customer_support_ticket_v1(...)`, require a description, and render customer-safe ticket projections. |
| Announcements / alerts / launch sections | ✅ VERIFIED COMPLETE | Buyer Home renders the existing `SystemAlertMarquee`; launch/festival/bestseller sections remain outside the approved implemented contract unless separately assigned. |
| Loading / empty / error / stale-session states | ✅ VERIFIED COMPLETE | Buyer data loading, empty, error/toast and refresh states are implemented in the route tree; auth/session redirects remain governed by the existing auth provider. |
| Mobile UX/accessibility | ✅ VERIFIED COMPLETE | Buyer navigation is responsive with mobile bottom navigation and touch-sized controls; automated typecheck/build and repository gates pass. Authenticated device/runtime evidence remains a separate gate. |
| Core RLS/RBAC/idempotency authority | ✅ VERIFIED COMPLETE (dependency evidence) | Current Core main contains authenticated buyer-scoped projections, service-bound pricing resolution, RLS draft reads/no direct draft writes, idempotent checkout promotion, customer-safe status/items/support contracts. Runtime production verification remains an upstream release gate for any dependent merge. |
| WhatsApp / Finance / Factory / Trace / CRM / Factory Gate | ➖ OUT OF THIS WORKSTREAM | Do not modify or absorb defects from these authorities. |

## Core contract inventory verified on current Core main

The current Core migration lineage includes the previously governed Buyer/customer contract family: buyer pricing and MOQ, customer-safe order status/items, support ticket projection/submission, buyer company/team projections, persistent customer draft/cart mutations, server-side quantity validation, checkout-time authority resolution, and idempotent `submit_customer_order_v1`. These contracts are to be reused; no shadow App authority or direct operational-table mutation is permitted.

## Exit gates

### Implementation progress (current branch)

- [x] Dedicated APP-E2E branch created from current Central main.
- [x] Governed client wrappers added for Core buyer identity, pricing, draft/cart, checkout, order projections and support contracts.
- [x] Buyer route tree and mobile navigation shell added; buyer roles now land on `/buyer` when approved company context exists.
- [x] Catalogue search/filter/detail and Core-backed persistent cart added.
- [x] Checkout UI uses Core `submit_customer_order_v1` with a stable retry key; it does not calculate or write Finance state.
- [x] Support ticket modal/page uses Core submission RPC; direct customer audit-table writes removed from callback UI.
- [x] Quick buy/reorder, catalogue/detail, cart/MOQ, checkout/order inward, order projections, support tickets, account context, alerts and Buyer loading/error/empty/mobile states are implemented and covered by the current branch checks.
- [ ] Durable favourites, statements, customer-safe documents and richer Finance-backed commercial cards remain blocked on Core contracts and/or protected runtime proof.
- [ ] Browser/Playwright golden-path evidence and production-runtime verification remain outstanding.
- [ ] Upstream Core protected production deployment/runtime verification for the customer checkout tranche is not evidenced in the current repository; dependent App merge must wait for Mission Control confirmation.

- [x] Buyer route tree and mobile shell are complete and connected to authenticated buyer context.
- [x] Catalogue/detail/cart use customer-safe Core contracts; MOQ/carton errors are actionable.
- [x] Submission uses only the governed Core checkout RPC with stable idempotency and retry-safe UI.
- [x] Orders/status/items/support are customer-safe projections with correct empty/loading/error states.
- [x] No authoritative Finance calculation or direct `orders`/`order_items`/support-table mutation remains in the Buyer path.
- [x] Required frontend regression coverage, typecheck, lint and production build checks pass on PR #421's current head; live authenticated/Core/Finance handoff evidence remains pending.
- [ ] Any required Core change is separately merged, protected-deployed, and runtime-verified before dependent App merge.
- [ ] Final golden paths are demonstrated: authenticated buyer order inward to canonical SO/Finance handoff, and non-order support/query path.

### Runtime / upstream gate boundary

- [ ] Protected Core production deployment and runtime verification for `submit_customer_order_v1` and the customer checkout contracts are evidenced by Mission Control.
- [ ] Authenticated golden-path evidence proves Buyer → governed order inward → canonical SO → Finance-visible projection/review → Buyer-safe projection. The App code is ready; this cannot be claimed from CI or a Vercel preview alone.

## Non-blocking later-stage gaps

Historical legacy defaults, broad legacy order normalization, and any additional provenance-copy cleanup are not part of this APP-E2E implementation unless current evidence shows a direct violation of the Buyer/Core contract.
