# APP-E2E — Front / Buyer App + App Order Inward Completion Ledger

**Baseline:** Central `origin/main` `a72443582d2228d7efe47f0e206670873c29cb8a` (2026-08-30)  
**Feature branch:** `codex/app-e2e-front-buyer-order-inward`  
**Boundary:** customer-facing Front/Buyer App and App-generated order inward only. Core schema/RPC authority remains in `oasis-supabase-core`; WhatsApp, Finance authority, Factory, Trace, CRM and Factory Gate are out of scope.

## Status legend

- ✅ VERIFIED COMPLETE — current code and authority evidence prove the capability.
- 🟨 BUILT — NEEDS HARDENING — implementation exists but is not yet complete/contract-safe.
- 🟧 PARTIAL / UNCONNECTED — some assets exist, but the current customer journey is not wired end to end.
- 🟥 BROKEN — current behavior violates the approved journey or authority boundary.
- ⬜ MISSING — no current-main implementation was found.
- ⛔ BLOCKED — requires an upstream Core gate or owner decision before safe completion.
- ➖ OUT OF THIS WORKSTREAM — intentionally not owned here.

## Current-main reconciliation

| Surface / capability | Status | Evidence and remaining work |
|---|---|---|
| Authentication, splash, login, password reset | 🟨 BUILT — NEEDS HARDENING | `Splash`, `Login`, `ResetPassword`, `AuthProvider` and role routing exist. Buyer onboarding/access-request completion and customer-safe post-auth destination are not proven as a complete journey. |
| Buyer/customer route tree and mobile shell | 🟥 BROKEN | Current `src/App.tsx` routes storefront roles to `/customer-app-redirect`; no Buyer Home/Catalogue/Product/Cart/Orders/Account route tree exists on current main. |
| Customer/company context | 🟧 PARTIAL / UNCONNECTED | Core exposes `customer_buyer_eligible_company_id()`, `customer_company_v1()` and `customer_team_v1()`; no current Buyer screen consumes these contracts. |
| Catalogue, categories, search and filters | 🟧 PARTIAL / UNCONNECTED | `useProducts` and `isBuyerVisibleProduct` exist, but there is no Buyer catalogue screen. Core pricing authority is `buyer_product_prices_v1()` / `customer_resolve_buyer_product_authority_v1(...)`; frontend wiring is absent. |
| Product detail and customer-safe pricing | 🟧 PARTIAL / UNCONNECTED | Product data/predicate helpers exist; no customer-facing detail route or governed price display is present. |
| Favourites | ⛔ BLOCKED | No current-main favourite contract/RPC was found in canonical Core; durable cross-device favourites require a Core authority assignment. No shadow table or direct write is being added. |
| Quick buy and reorder | 🟨 BUILT — NEEDS HARDENING | Quick buy and reorder now reuse governed draft-line RPCs; product availability/MOQ failures remain Core-authoritative. |
| Persistent cart / MOQ / carton validation | 🟨 BUILT — NEEDS HARDENING | Core customer draft RPC family exists (`get/add/update/remove/clear_customer_order_draft_v1`, readiness and validation helpers). Existing frontend has no connected cart journey. |
| App order submission / order inward | 🟨 BUILT — NEEDS HARDENING | Core `submit_customer_order_v1(text,date)` is an idempotent governed promotion path with authoritative pricing and 30%-round-up advance. No current Buyer caller exists; legacy `CheckoutModal` directly updates `orders` and calculates 20%/₹1,000, so it is not safe to reuse as-is. |
| Order list, detail, status and tracking presentation | 🟧 PARTIAL / UNCONNECTED | Core `customer_order_status_v1()` and `customer_order_items_v1()` plus `CustomerOrderTimeline` exist; no Buyer list/detail route consumes them. |
| SO / PI / invoice / document presentation | ⛔ BLOCKED | Current-main Buyer document screens are absent. Exact customer-safe document contracts and the Core PI production gate must be confirmed before exposing issuance/frozen commercial truth. |
| Wallet / credit / payment presentation | ➖ OUT OF THIS WORKSTREAM | Finance owns authority. Buyer may display only supplied governed facts after the Finance/Core contract is production-verified. |
| Statements | ⛔ BLOCKED | No current Buyer statement surface or verified customer-safe statement contract found; requires Core authority assignment. |
| Profile / company / team | 🟧 PARTIAL / UNCONNECTED | Core company/team projections exist; no current Buyer screens consume them. |
| Support chat / callback | 🟨 BUILT — NEEDS HARDENING | `SupportChat` exists but writes `audit_logs` directly and depends on a hard-coded Edge Function URL; customer-safe governed support contract and retry/error handling need verification. |
| Support tickets and evidence | 🟥 BROKEN | `SupportTicketModal` is demo-only: it never calls Core `submit_customer_support_ticket_v1(...)`, has no description persistence, and photo upload is a no-op. |
| Announcements / alerts / launch sections | 🟧 PARTIAL / UNCONNECTED | `SystemAlertMarquee` and admin announcement surfaces exist; no Buyer route/contract wiring is present. |
| Loading / empty / error / stale-session states | 🟨 BUILT — NEEDS HARDENING | Shared error boundaries and loading patterns exist, but Buyer-specific states do not exist because the route tree is absent. |
| Mobile UX/accessibility | ⬜ MISSING | No current Buyer shell to verify against the approved mobile-first journey. |
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
- [ ] Product favourites, quick buy/reorder, statements, documents and richer announcement sections remain to be implemented or verified against approved Core contracts.
- [ ] Browser/Playwright golden-path evidence and production-runtime verification remain outstanding.
- [ ] Upstream Core protected production deployment/runtime verification for the customer checkout tranche is not evidenced in the current repository; dependent App merge must wait for Mission Control confirmation.

- [x] Buyer route tree and mobile shell are complete and connected to authenticated buyer context.
- [x] Catalogue/detail/cart use customer-safe Core contracts; MOQ/carton errors are actionable.
- [x] Submission uses only the governed Core checkout RPC with stable idempotency and retry-safe UI.
- [x] Orders/status/items/support are customer-safe projections with correct empty/loading/error states.
- [x] No authoritative Finance calculation or direct `orders`/`order_items`/support-table mutation remains in the Buyer path.
- [ ] Required adversarial and regression tests pass; typecheck/lint/build pass.
- [ ] Any required Core change is separately merged, protected-deployed, and runtime-verified before dependent App merge.
- [ ] Final golden paths are demonstrated: authenticated buyer order inward to canonical SO/Finance handoff, and non-order support/query path.

## Non-blocking later-stage gaps

Historical legacy defaults, broad legacy order normalization, and any additional provenance-copy cleanup are not part of this APP-E2E implementation unless current evidence shows a direct violation of the Buyer/Core contract.
