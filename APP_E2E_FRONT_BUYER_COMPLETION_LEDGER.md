# APP-E2E — Front / Buyer App + App Order Inward Completion Ledger

**Baseline:** Central `origin/main` `36dd63d4a9ffaf8760c1dddddbf00f81609a8f95` (2026-08-31)
**Feature branch:** `codex/app-e2e-tranche3-buyer-ux-closure`
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

## Current-main baseline reconciled for Tranche 3

The Tranche 3 branch starts from the actual post-merge Central `main` at
`36dd63d4a9ffaf8760c1dddddbf00f81609a8f95` (PR #426). The Tranche 2
commercial-visibility work remains historical evidence below; this section
records only the current Buyer surface and the narrow UX closure being built
on top of it. A ✅ status means the current branch code and rendered checks
prove the software behavior; it does not assert protected Core runtime
deployment or authenticated production verification.

### Tranche 2: ✅ MERGED

- **PR:** #426 (`codex/app-e2e-tranche2-commercial-visibility` → `main`)
- **Merge SHA:** `36dd63d4a9ffaf8760c1dddddbf00f81609a8f95`
- **Scope:** buyer commercial visibility, Core-owned pricing/order identity and
  dispatch-date presentation; no frontend Finance authority was introduced.

### Tranche 3 current reconciliation

| Buyer surface | Classification | Current evidence / boundary |
|---|---|---|
| Authentication, onboarding and access request | VERIFIED DONE | Existing auth/role route guards remain in `src/App.tsx`; the access request form now has semantic labels, input types and governed `submit_b2b_trade_application_v1` submission. Approval remains an internal authority. |
| Company context, dashboard and safe account state | VERIFIED DONE | Dashboard prioritises catalogue, cart, orders and support, shows only Core company/order/ticket counts and safe account status, and has no fabricated Finance cards. |
| Catalogue, categories, search, SKU/image/UOM/price/MOQ | VERIFIED DONE | Active/visible products and Core `buyer_product_prices_v1()` are rendered with supported category/search filters, branded image fallback and governed quantity controls. |
| Product detail, Add and Buy now | VERIFIED DONE | Detail presents SKU, customer-safe price/UOM/MOQ/increment; both actions use the existing Core draft-line RPC path. |
| Favourites | MISSING / CORE DEPENDENCY | No canonical durable favourite contract is available; no browser shadow authority is being added. |
| Quick buy, reorder and persistent cart | VERIFIED DONE | Quick buy and reorder reuse Core draft RPCs; cart keeps line snapshots, unit/line previews, update/remove/clear and retry-safe submit. |
| MOQ/carton validation and assistance | VERIFIED DONE | Readiness details are translated from returned Core values; the UI never invents a quantity or carton rule. |
| App order inward and SO identity | VERIFIED DONE | Checkout calls only idempotent `submit_customer_order_v1`; the Buyer displays the exact returned order/SO identity and preserves the retry key after failures. |
| Orders, detail, status, dispatch and tracking | VERIFIED DONE | Cards and detail use customer-safe stage/payment labels, distinct requested/promised dates, safe timeline and tracking only when Core supplies it. |
| SO / PI / invoice / document presentation | PARTIALLY DONE / CORE DEPENDENCY | SO value/reference presentation is connected; Documents intentionally shows availability only and never invents PI/invoice numbers or download links until Core exposes them. |
| Wallet, credit, payment and statements | BLOCKED BY EXTERNAL AUTHORITY | Finance facts remain presentation-only and require the protected, customer-safe Core contract/runtime gate. |
| Profile, company, team and sign-out | VERIFIED DONE | Account shows safe company/team information and links to governed orders, documents and support without role codes. |
| Support tickets / customer support path | VERIFIED DONE | Buyer Support uses `submit_customer_support_ticket_v1`, requires an order and description, and states that support is separate from checkout. No second chat/order authority is introduced. |
| Announcements and launch sections | PARTIALLY DONE / APPROVED-SCOPE DEPENDENCY | Existing `SystemAlertMarquee` remains; no unsupported festival/bestseller data contract is fabricated. |
| Loading, empty, error, retry and stale-submit states | VERIFIED DONE | Buyer data errors have a retry action; route surfaces have loading/empty states; checkout uses stable idempotency and preserves cart state on failure. |
| Mobile UX and accessibility | VERIFIED DONE | Five-point semantic navigation, dominant logo dashboard, support FAB, labels/aria text, touch-sized controls and responsive cards are implemented. |
| Legacy/duplicate surfaces | DEPRECATE_LATER | `SupportChat` is unreferenced from the Buyer route and retains a legacy hard-coded Edge Function dependency; old `CheckoutModal` remains non-authoritative. Neither is reachable through the current Buyer journey. |
| Protected Core/Finance runtime | BLOCKED BY EXTERNAL AUTHORITY | Central can consume only deployed, verified customer-safe contracts; no Core schema/RPC or production change is made in this tranche. |

The current Buyer support path is the governed order-ticket page. Historical
`SupportChat` references are retained for audit history, but the component is
not imported by `BuyerApp` and is not a second active customer support writer.

### Tranche 3 verification evidence (current branch)

- Buyer rendered/behavioral suite: **25 passed** (`BuyerApp.test.tsx` and
  `customerPresentation.test.ts`).
- Touched-file ESLint: **PASS**; TypeScript typecheck: **PASS**; production
  build: **PASS**.
- Read-only local Playwright smoke at 375, 390 and 430 px: **PASS** for no
  horizontal overflow and no console errors on the guarded Buyer entry route.
- Full Vitest suite: **1,687 passed / 5 historical WhatsApp fixture assertions
  failed**. Those failures predate this tranche and are outside the Buyer
  boundary; no WhatsApp code or fixture was changed.
- Repository boundary script could not execute on this Windows host because a
  Bash runtime is unavailable; Central contains no `supabase/migrations`
  directory and no Core schema files were added.

## Historical Tranche 2 baseline and owner-approved policy

The evidence below records the current-main state after Tranche 1 merged and the Tranche 2 audit. A ✅ status means the Buyer software capability is implemented and covered by automated checks; it does not by itself assert protected production deployment or authenticated runtime verification.

## Tranche 2 owner-approved document/reference policy

- **Customer-visible SO format:** `SOYYYY/MM-NNNN` (four-digit monthly
  sequence, company-wide across all governed intake sources). Core owns
  allocation and the Buyer displays only the exact reference returned by Core;
  the frontend never predicts or constructs an SO number.
- **Customer-visible PI format:** `PIYYYY/MM-NNN` (three-digit monthly
  sequence, independent from SO). The Buyer displays a PI number only after
  governed Finance issuance and only when the canonical Core contract returns
  it. Before issuance, no PI number is shown.
- **Policy state:** owner-approved; production Core numbering and the
  customer-safe PI projection remain separate runtime/deployment gates.

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
| Buyer → Finance identity continuity | 🟨 BUILT — NEEDS HARDENING | `submit_customer_order_v1` returns one governed `order_id`/`order_number` and the Buyer follows that identity into `customer_order_status_v1`; Order Detail presents the Core-returned SO reference, SO value and requested/promised dispatch facts. Exact commercial-version/PI/Finance projection needed to prove the full handoff is not deployed to production. |
| SO / PI / invoice / document presentation | 🟧 PARTIAL / UNCONNECTED | Buyer presents the Core-returned SO reference and governed order value. Core main contains internal PI/final-invoice authority, but production does not expose a customer-safe SO snapshot/PI/invoice projection; no PI number is predicted or synthesized. |
| Wallet / credit / payment presentation | ⛔ CORE CONTRACT REQUIRED | Finance owns authority. Core main contains Finance/payment/credit/wallet authorities, but production exposure of customer-safe Buyer facts is not evidenced; Buyer must display only a governed projection once deployed and verified. |
| Statements | ⛔ CORE CONTRACT REQUIRED | No current Buyer statement surface or verified customer-safe statement contract found; requires a production Core authority assignment. |
| Profile / company / team | ✅ VERIFIED COMPLETE | Buyer Account consumes Core company/team projections and provides governed sign-out. |
| Support chat / callback | ➖ DEPRECATE LATER / UNREACHABLE | The current Buyer route uses the governed Support page and `submit_customer_support_ticket_v1`. Historical `SupportChat` remains unreferenced and retains a hard-coded legacy Edge Function dependency; it is not an active Buyer writer and is not being rebuilt in this tranche. |
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

Current Core `origin/main` `d0bf266f20378ca6b538564600f78ca6a79fa086` also
contains PF-5/PF-6A/PF-6B/PF-6C and Finance Exit customer/Finance authorities.
However, unauthenticated read-only probes against production returned
PostgREST schema-cache `404` for `get_customer_financial_360_v1` and
`get_order_payment_facts_v1`, `get_finance_operations_clearance_facts_v1` and
the internal PI authority view. The newer PI/Finance facts therefore cannot be
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
  download references; customer-visible PI numbering is null before governed
  Finance issuance and, after issuance, must be the exact Core-returned value
  in the owner-approved `PIYYYY/MM-NNN` format;
- company scope, facts-as-of timestamp and no cross-company rows.

The contract must fail closed for anonymous users, reject another company,
avoid direct Buyer writes, and preserve the existing separation between payment
verification and Finance clearance. Until that contract is protected-deployed
and runtime-verified, the Buyer App will not calculate or display authoritative
wallet, advance, credit, PI, invoice or statement facts.

## Tranche 2 gate register

| Gate | Current status | Evidence / next boundary |
|---|---|---|
| Requested dispatch date | ✅ VERIFIED COMPLETE | Buyer captures an optional date and forwards it as `p_requested_dispatch_date` to `submit_customer_order_v1`; Core validates and persists it. |
| Buyer → canonical order | ✅ VERIFIED COMPLETE (software) | The governed checkout RPC returns one `order_id`/`order_number` and is retry/idempotency-safe; authenticated production golden-path execution remains a separate runtime gate. |
| Canonical SO identity | 🟨 BUILT — NEEDS HARDENING | Buyer displays the exact Core-returned `order_number` and flags a non-approved legacy format; SO allocation and the approved `SOYYYY/MM-NNNN` sequence remain Core-owned. |
| SO number source | CORE OWNED | Central never predicts or constructs SO numbers. |
| SO → Finance identity | 🟧 PARTIAL / UNCONNECTED | `order_id` continuity is present through the Buyer status projection, but production lacks the customer-safe commercial-version/Finance projection needed to prove the full handoff. |
| Payment facts | ⛔ CORE DEPLOYMENT REQUIRED | Production read-only probe: `get_order_payment_facts_v1` returns PostgREST schema-cache `404`; do not add an untyped fallback. |
| Wallet | ⛔ CORE DEPLOYMENT REQUIRED | Core authority exists on Core main, but no deployed customer-safe Buyer projection is evidenced. |
| Credit | ⛔ CORE DEPLOYMENT REQUIRED | Core authority exists on Core main, but no deployed customer-safe Buyer projection is evidenced. |
| Finance clearance | ⛔ CORE CONTRACT REQUIRED | Internal Finance clearance facts are not customer-safe; Buyer requires a company-scoped action/status projection. |
| Customer-safe PI | ⛔ CORE CONTRACT REQUIRED | Owner-approved `PIYYYY/MM-NNN` format is recorded, but production exposes no customer-safe PI state/number contract; no pre-issuance number is shown. |
| Customer-safe invoice | ⛔ CORE CONTRACT REQUIRED | No deployed customer-safe invoice availability/ID/download projection is evidenced. |
| Statement | ⛔ CORE CONTRACT REQUIRED | No deployed customer-safe statement contract is evidenced. |
| Durable favourites | ⛔ CORE CONTRACT REQUIRED | No canonical Core favourite authority is present; no browser/local shadow truth is allowed. |
| Full Buyer → SO → Finance → Buyer golden path | BLOCKED | Awaiting protected Core deployment and authenticated production verification of the exact customer-safe contract. |
| Central owner action | NONE FOR CURRENT SLICE | Core/Mission Control must provide the deployment and runtime evidence; Central must not deploy or mutate production. |

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
