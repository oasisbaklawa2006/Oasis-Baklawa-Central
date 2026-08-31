# APP-E2E — Front / Buyer App + App Order Inward Completion Ledger

**Baseline:** Central `origin/main` `6d7213f12a45c274235301113a7595e8142b3` (2026-08-31)
**Feature branch:** `codex/app-e2e-tranche2-commercial-visibility`
**Boundary:** customer-facing Front/Buyer App and App-generated order inward only. Core schema/RPC authority remains in `oasis-supabase-core`; WhatsApp, Finance authority, Factory, Trace, CRM and Factory Gate are out of scope.

## Status legend

- ✅ VERIFIED COMPLETE — current branch code and automated checks prove the software capability; protected production/runtime proof is tracked separately where required.
- 🟨 BUILT — NEEDS HARDENING — implementation exists but is not yet complete/contract-safe.
- 🟧 PARTIAL / UNCONNECTED — some assets exist, but the current customer journey is not wired end to end.
- 🟥 BROKEN — current behavior violates the approved journey or authority boundary.
- ⬜ MISSING — no current-main implementation was found.
- ⛔ BLOCKED — requires an upstream Core gate or owner decision before safe completion.
- ➖ OUT OF THIS WORKSTREAM — intentionally not owned here.

## APP-E2E Tranche 1 — MERGED

- **PR:** #421 (`codex/app-e2e-front-buyer-order-inward` → `main`)
- **Merge SHA:** `6d7213f12a45c274235785301113a7595e8142b3`
- **Software implementation/merge:** COMPLETE
- **Production Core contract presence:** VERIFIED for the governed Buyer RPC set recorded below
- **Full authenticated production golden-path certification:** PENDING
- **Full APP-E2E programme:** NOT COMPLETE

The Tranche 1 software merge is complete. Production contract presence and
authenticated golden-path evidence are separate claims: the first is verified
for the established Buyer RPC set, while the second still requires an approved
authenticated runtime run. Tranche 2 must not invent customer-safe Finance or
document projections where production does not expose the corresponding Core
contract.

## Current-main baseline reconciled for Tranche 2

The evidence below records the current-main state after Tranche 1 merged and the Tranche 2 audit. A ✅ status means the Buyer software capability is implemented and covered by automated checks; it does not by itself assert protected production deployment or authenticated runtime verification.

| Surface / capability | Status | Evidence and remaining work |
|---|---|---|
| Authentication, splash, login, password reset and access request | ✅ VERIFIED COMPLETE | `Splash`, `Login`, `ResetPassword`, `AuthProvider`, role routing and the authenticated `BuyerAccessRequest` form are wired; access requests call `submit_b2b_trade_application_v1`. Approval and protected runtime evidence remain upstream gates. |
| Buyer/customer route tree and mobile shell | ✅ VERIFIED COMPLETE | `src/App.tsx` routes approved buyer roles to `/buyer`; `BuyerApp` provides Home, Catalogue, Product, Cart, Orders, Account and Support routes with responsive navigation. |
| Customer/company context | ✅ VERIFIED COMPLETE | Buyer screens consume Core `customer_company_v1()` and `customer_team_v1()` projections; unresolved approval still remains a governed access decision. |
| Catalogue, categories, search and filters | ✅ VERIFIED COMPLETE | Buyer catalogue reads active/visible products, governed `buyer_product_prices_v1()` pricing, category filters and search; no catalogue authority is duplicated. |
| Product detail and customer-safe pricing | ✅ VERIFIED COMPLETE | Buyer product detail presents approved catalogue metadata and customer-safe Core pricing/MOQ/UOM values. |
| Favourites | ⬜ MISSING | No current-main favourite contract/RPC was found in canonical Core; durable cross-device favourites require a Core authority assignment. No shadow table or direct write is being added. |
| Quick buy and reorder | ✅ VERIFIED COMPLETE | Quick buy and reorder reuse governed draft-line RPCs; product availability/MOQ failures remain Core-authoritative. |
| Persistent cart / MOQ / carton validation | ✅ VERIFIED COMPLETE | Buyer cart uses the Core draft RPC family (`get/add/update/remove/clear_customer_order_draft_v1`) and surfaces readiness/MOQ/carton errors without direct table writes. |
| App order submission / order inward | ✅ VERIFIED COMPLETE | Buyer checkout calls idempotent Core `submit_customer_order_v1` with a stable retry key; Core owns authoritative pricing and the 30%-round-up advance. The legacy `CheckoutModal` is explicitly non-authoritative and no longer calculates or writes order/Finance state. |
| Order list, detail, status and tracking presentation | ✅ VERIFIED COMPLETE | Buyer Orders and Order Detail consume Core `customer_order_status_v1()` and `customer_order_items_v1()` projections and expose safe status, payment-stage and dispatch information. |
| Buyer → Finance identity continuity | 🟧 PARTIAL / UNCONNECTED | `submit_customer_order_v1` returns one governed `order_id`/`order_number` and the Buyer follows that identity into `customer_order_status_v1`; no production customer-safe contract currently exposes the exact SO/commercial-version/PI/Finance projection needed to prove the full handoff. |
| SO / PI / invoice / document presentation | ⛔ CORE CONTRACT REQUIRED | Current-main Buyer document screens are absent. Core main contains internal PI/final-invoice authority, but the production schema cache does not expose the required customer-safe document projection; do not read internal Finance/PI tables directly. |
| Wallet / credit / payment presentation | ⛔ CORE CONTRACT REQUIRED | Finance owns authority. Core main contains Finance/payment/credit/wallet authorities, but production exposure of customer-safe Buyer facts is not evidenced; Buyer must display only a governed projection once deployed and verified. |
| Statements | ⛔ CORE CONTRACT REQUIRED | No current Buyer statement surface or verified customer-safe statement contract found; requires a production Core authority assignment. |
| Profile / company / team | ✅ VERIFIED COMPLETE | Buyer Account consumes Core company/team projections and provides governed sign-out. |
| Support chat / callback | 🟨 BUILT — NEEDS HARDENING | `SupportChat` exists but writes `audit_logs` directly and depends on a hard-coded Edge Function URL; customer-safe governed support contract and retry/error handling need verification. |
| Support tickets and evidence | ✅ VERIFIED COMPLETE | Buyer Support and `SupportTicketModal` call Core `submit_customer_support_ticket_v1(...)`, require a description, and render customer-safe ticket projections. |
| Announcements / alerts / launch sections | ✅ VERIFIED COMPLETE | Buyer Home renders the existing `SystemAlertMarquee`; launch/festival/bestseller sections remain outside the approved implemented contract unless separately assigned. |
| Loading / empty / error / stale-session states | ✅ VERIFIED COMPLETE | Buyer data loading, empty, error/toast and refresh states are implemented in the route tree; auth/session redirects remain governed by the existing auth provider. |
| Mobile UX/accessibility | ✅ VERIFIED COMPLETE | Buyer navigation is responsive with mobile bottom navigation and touch-sized controls; automated typecheck/build and repository gates pass. Authenticated device/runtime evidence remains a separate gate. |
| Core RLS/RBAC/idempotency authority | ✅ VERIFIED COMPLETE (Tranche 1 dependency evidence) | Current Core main and the post-merge production checks preserve the established authenticated Buyer projections, service-bound pricing resolution, RLS draft reads/no direct draft writes, idempotent checkout promotion, and customer-safe status/items/support contracts. Full authenticated golden-path runtime evidence remains pending; newer Finance/document contracts are separately tracked as not present in the production schema cache. |
| WhatsApp / Finance / Factory / Trace / CRM / Factory Gate | ➖ OUT OF THIS WORKSTREAM | Do not modify or absorb defects from these authorities. |

## Core contract inventory verified on current Core main

The current Core migration lineage includes the previously governed Buyer/customer contract family: buyer pricing and MOQ, customer-safe order status/items, support ticket projection/submission, buyer company/team projections, persistent customer draft/cart mutations, server-side quantity validation, checkout-time authority resolution, and idempotent `submit_customer_order_v1`. These contracts are to be reused; no shadow App authority or direct operational-table mutation is permitted.

### Tranche 2 production contract evidence

Central post-merge checks for `6d7213f12a45c274235785301113a7595e8142b3` are green:
Release Quality Gate, CircleCI, CodeQL and ownership boundaries all passed.

The configured production Supabase project is `ACTIVE_HEALTHY`. Read-only
inspection verified authenticated execution and anonymous denial for the
established Buyer RPC set: `customer_company_v1`, `customer_team_v1`,
`buyer_product_prices_v1`, `get_customer_order_draft_v1`,
`add_customer_order_draft_line_v1`, `update_customer_order_draft_line_v1`,
`remove_customer_order_draft_line_v1`, `clear_customer_order_draft_v1`,
`submit_customer_order_v1`, `customer_order_status_v1`,
`customer_order_items_v1`, `customer_support_tickets_v1`,
`submit_customer_support_ticket_v1`, and `submit_b2b_trade_application_v1`.

Current Core `origin/main` `001ff26d57ff44db01590a39913d56c44798c804` also
contains PF-5/PF-6A/PF-6B/PF-6C and Finance Exit customer/Finance authorities.
However, unauthenticated read-only probes against production returned
PostgREST schema-cache `404` for `get_customer_financial_360_v1` and
`get_order_payment_facts_v1`. The newer PI/Finance facts therefore cannot be
used by the Buyer App until the owning Core release is protected-deployed and
the exact customer-safe contract is verified in production. This is a scoped
Tranche 2 dependency, not a reason to create a Central shadow authority.

### Exact Core contract request for the blocked Tranche 2 surfaces

The owning Core release must expose a customer-safe, authenticated,
company-scoped read contract (for example a versioned `customer_financial_360`
family) that is present in the protected production schema and covered by RLS/
grant tests. It must return, without exposing internal Finance tables or
decision notes:

- order/SO identity, exact commercial version and source-safe status;
- customer-safe line/product/quantity/UOM and frozen commercial totals;
- advance rule/result, verified payment/credit/wallet coverage and remaining
  amount due;
- customer-safe Finance operations state and action-required message;
- PI/final-invoice/statement availability, exact linked IDs and governed
  download references (customer-visible PI numbering remains null until its
  owner policy is resolved);
- company scope, facts-as-of timestamp and no cross-company rows.

The contract must fail closed for anonymous users, reject another company,
avoid direct Buyer writes, and preserve the existing separation between payment
verification and Finance clearance. Until that contract is protected-deployed
and runtime-verified, the Buyer App will not calculate or display authoritative
wallet, advance, credit, PI, invoice or statement facts.

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
- [x] Production presence for the established Buyer RPC set is verified; full authenticated Core runtime/golden-path certification remains pending as a separate Mission Control gate.

- [x] Buyer route tree and mobile shell are complete and connected to authenticated buyer context.
- [x] Catalogue/detail/cart use customer-safe Core contracts; MOQ/carton errors are actionable.
- [x] Submission uses only the governed Core checkout RPC with stable idempotency and retry-safe UI.
- [x] Orders/status/items/support are customer-safe projections with correct empty/loading/error states.
- [x] No authoritative Finance calculation or direct `orders`/`order_items`/support-table mutation remains in the Buyer path.
- [x] Required frontend regression coverage, typecheck, lint and production build checks pass on PR #421's current head; live authenticated/Core/Finance handoff evidence remains pending.
- [x] Tranche 1 software implementation and merge are complete; production presence is verified for the established Buyer RPC set.
- [ ] Any future Tranche 2 surface that consumes a newer Core contract is held until that exact customer-safe contract is protected-deployed and verified in production.
- [ ] Final golden paths are demonstrated: authenticated buyer order inward to canonical SO/Finance handoff, and non-order support/query path.

### Runtime / upstream gate boundary

- [x] Protected production contract presence for the established Buyer RPC set is evidenced by the read-only inspection recorded above.
- [ ] Protected Core deployment/runtime verification for the newer Finance/document projections is evidenced by Mission Control.
- [ ] Authenticated golden-path evidence proves Buyer → governed order inward → canonical SO → Finance-visible projection/review → Buyer-safe projection. The App code is ready; this cannot be claimed from CI or a Vercel preview alone.

## Non-blocking later-stage gaps

Historical legacy defaults, broad legacy order normalization, and any additional provenance-copy cleanup are not part of this APP-E2E implementation unless current evidence shows a direct violation of the Buyer/Core contract.
