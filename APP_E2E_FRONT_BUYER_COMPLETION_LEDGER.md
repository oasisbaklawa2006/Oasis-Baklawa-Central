# APP-E2E — Front / Buyer App + App Order Inward Completion Ledger

**Current baseline:** Central `origin/main` `8d24c99464558ccfcd9ca0cb7be538025f7f638c` (2026-09-01)
**Current feature branch:** `codex/app-e2e-tranche5-central-binding`
**Historical Tranche 4 baseline:** `9b59bcfb3cd454b9d613819ef7e7a81a24271b5c`
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

## APP-E2E Tranche 3 — ✅ MERGED

- **PR:** #427 (`codex/app-e2e-tranche3-buyer-ux-closure` → `main`)
- **Merge SHA:** `d73db427027b542dafa436190078aee8c48078a1`
- **Historical PR head at merge:** `bd4e4c83ea50824e3dd8a0e0b84e428e956b5ded`
- **Software implementation/merge:** COMPLETE
- **Tranche 4 baseline:** current Central `main` is `9b59bcfb3cd454b9d613819ef7e7a81a24271b5c` (PR #428 and the later FACT-C3 merge are above the Tranche 3 merge).

The Tranche 3 branch/head is historical evidence only. Tranche 4 is a
separate release-closure branch and does not reuse or rewrite that branch.

## Historical Tranche 3 baseline reconciliation (pre-merge evidence)

The Tranche 3 branch was based on the then-current Central `main` at
`36dd63d4a9ffaf8760c1dddddbf00f81609a8f95` (PR #426). The Tranche 2
commercial-visibility work remains historical evidence below; this section
records only the current Buyer surface and the narrow UX closure being built
on top of it. A ✅ status means the then-current Tranche 3 branch code and rendered checks
prove the software behavior; it does not assert protected Core runtime
deployment or authenticated production verification.

### Tranche 2: ✅ MERGED

- **PR:** #426 (`codex/app-e2e-tranche2-commercial-visibility` → `main`)
- **Merge SHA:** `36dd63d4a9ffaf8760c1dddddbf00f81609a8f95`
- **Scope:** buyer commercial visibility, Core-owned pricing/order identity and
  dispatch-date presentation; no frontend Finance authority was introduced.

### Historical Tranche 3 reconciliation

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
| Order-linked support tickets | VERIFIED DONE | Buyer Support uses the governed `submit_customer_support_ticket_v1`, requires an order and description, preserves the established support issue vocabulary at the client boundary, and remains separate from checkout. |
| General / non-order customer query inward | BLOCKED BY EXTERNAL AUTHORITY | The established Buyer support RPC is order-linked (`p_order_id` is required). No verified order-optional/general-query Core contract exists in the current Buyer contract family, so Central does not create a shadow writer or silently convert general queries into Sales Orders. |
| Announcements and launch sections | PARTIALLY DONE / APPROVED-SCOPE DEPENDENCY | Existing `SystemAlertMarquee` remains; no unsupported festival/bestseller data contract is fabricated. |
| Loading, empty, error, retry and stale-submit states | VERIFIED DONE | Buyer data errors have a retry action; customer RPC failures are normalized at the client boundary instead of exposing raw backend error text; route surfaces have loading/empty states; checkout uses stable idempotency and preserves cart state on failure. |
| Mobile UX and accessibility | VERIFIED DONE | Five-point semantic navigation, dominant logo dashboard, support FAB, labels/aria text, touch-sized controls and responsive cards are implemented. |
| Legacy/duplicate surfaces | DEPRECATE_LATER | `SupportChat` is unreferenced from the Buyer route and retains a legacy hard-coded Edge Function dependency; old `CheckoutModal` remains non-authoritative. Neither is reachable through the current Buyer journey. |
| Protected Core/Finance runtime | BLOCKED BY EXTERNAL AUTHORITY | Central can consume only deployed, verified customer-safe contracts; no Core schema/RPC or production change is made in this tranche. |

The active Buyer support path is the governed order-linked ticket page.
Historical `SupportChat` references are retained for audit history, but the
component is not imported by `BuyerApp` and is not a second active customer
support writer. A general/non-order customer query remains a separate Core
contract gap: the frontend must not create an SO or a Central shadow record to
pretend that path is complete.

### Historical Tranche 3 verification evidence (final pre-merge branch)

- Historical Tranche 3 takeover head: `2930cb77d4f669d018ffc42129f52449b70c91d3`.
- Hosted Release Quality Gate: **PASS**, including TypeScript, changed-file
  ESLint, full unit/migration-contract tests, production build and Playwright
  smoke.
- Repository ownership boundary workflow: **PASS**.
- CodeQL: **PASS** with no new alerts; JavaScript/TypeScript, Actions and Python
  analysis jobs all completed successfully.
- Codacy: **PASS** with zero annotations; Sourcery: **PASS** with no blocking
  security findings; Snyk: **PASS**; CodeRabbit: **PASS**; Vercel: **PASS**.
- GitHub Advanced Security AI review is an external-only failure: its configured
  `claude-opus-4.6` request returns `CAPIError: 400 The requested model is not
  supported`; ordinary CodeQL is green and this is not an application-code
  failure.
- Cursor Security Agent remains neutral because usage-based pricing is not
  available for that external agent.
- CircleCI did not emit a status context for PR #427 despite a valid repository
  `.circleci/config.yml`; the active repository ruleset does not require a
  CircleCI context, while the equivalent hosted Release Quality Gate fully
  passed on the final head. CircleCI absence is tracked as integration signal,
  not represented as a successful run.
- All previously raised Sourcery review threads are resolved; final governance
  still requires one human approving review after the final head push.

## APP-E2E Tranche 4 — Buyer frontend release closure

- **Branch:** `codex/app-e2e-tranche4-buyer-release-closure`
- **Baseline:** `9b59bcfb3cd454b9d613819ef7e7a81a24271b5c` (actual current Central `main` on 2026-09-01)
- **Scope:** frontend route closure, customer-safe failure states, mobile/accessibility hardening and retirement of proven-unreachable legacy customer writers. No Core/Finance/production changes.
- **Status:** FRONTEND COMPLETE — UPSTREAM CONTRACT BINDING REMAINS (scoped implementation and local certification complete; PR gates and independent approval pending).

### Tranche 4 route inventory (current as-built)

| Route surface | Classification | Evidence / remaining boundary |
|---|---|---|
| Splash, login, password recovery/reset, access request, approval-pending/unauthorised and stale-session paths | ✅ COMPLETE | `src/App.tsx`, `ProtectedRoute`, `RoleProtectedRoute` and the governed access-request RPC provide guarded entry; customer auth failures use bounded copy. Approval remains an internal decision. |
| Dashboard (`/buyer`) | ✅ COMPLETE | Company identity/status, action-required order state, New Order/catalogue, reorder/cart, Track Order through Orders, Support and recent-order links are presented without fabricated Finance values. |
| Catalogue (`/buyer/catalogue`) | ✅ COMPLETE | Active/visible products, supported search/category/subcategory filtering, neutral image fallback, safe price/MOQ/UOM states and duplicate-click protection are rendered from current catalogue fields. |
| Product detail (`/buyer/catalogue/:id`, legacy `/buyer/product/:id`) | ✅ COMPLETE | Direct/legacy deep links resolve to the governed detail view; invalid IDs fail closed; Add/Buy use only Core draft RPCs and are disabled while pending. |
| Cart (`/buyer/cart`) | ✅ COMPLETE | Core draft identity, quantity/MOQ/increment guidance, line-price preview, requested dispatch, retry-safe idempotent submission and safe network/read errors are preserved. |
| Orders (`/buyer/orders`) | ✅ COMPLETE | Empty, submitted, unknown-stage, requested/promised dispatch and customer-safe payment states are rendered from Core projections. |
| Order detail (`/buyer/orders/:id`) | ✅ COMPLETE | Invalid/company-inaccessible IDs fail closed; exact Core SO identity, items, one-current-stage timeline, tracking and governed reorder are presented. |
| Documents (`/buyer/documents`) | ✅ COMPLETE / CORE-BLOCKED CHILD CAPABILITIES | Sales Order reference availability is linked to Orders; PI, final invoice and statement cards remain neutral until customer-safe Core contracts issue them. No numbers, files or URLs are fabricated. |
| Account (`/buyer/account`) | ✅ COMPLETE | Company/team context, safe role labels, Orders/Documents/Support links and governed sign-out are available. |
| Support (`/buyer/support`) | ✅ COMPLETE / GENERAL QUERY CORE-BLOCKED | The only active submit path is order-linked `submit_customer_support_ticket_v1`; no general query is converted into an order or shadow record. |
| Unknown Buyer path | ✅ COMPLETE | Unknown paths now show a customer-safe recovery state instead of silently rendering the dashboard. |

### Tranche 4 authority and retirement audit

- **SupportChat:** REMOVED. Repository search proved no import, route or CTA; it contained a hard-coded legacy AI Edge Function and was superseded by governed order-linked Support.
- **CheckoutModal:** REMOVED. Repository search proved no import, route or CTA; it was a non-authoritative preview hand-off superseded by the Core draft/cart checkout.
- **SupportTicketModal:** RETAINED as a governed compatibility component; it has no direct table/Edge Function write and uses `customerAppClient.submitTicket`.
- **Active Buyer writes:** no direct `insert`, `update`, `delete`, `functions.invoke`, `fetch` or hard-coded mutation endpoint. Catalogue/system-alert reads are read-only; all active cart/order/support/access-request mutations go through `customerAppClient`.
- **Frontend fixes in this tranche:** unknown-route fail-closed recovery; legacy product deep-link redirect; malformed/missing price fail-closed controls; duplicate catalogue action suppression; bounded Buyer/auth/support error copy; safe ticket issue labels; four-category document availability cards; support-ticket accessibility labels; legacy writer retirement and regression guards.

### Tranche 4 certification evidence (local)

- Buyer route, presentation, client-contract and auth focused tests: **55/55 passed** (32 Buyer, 3 presentation, 4 client, 16 auth).
- Exact-head hosted Release Quality run **33478001528** executed the repository full `npm run test` suite successfully. **No current full-suite WhatsApp failure is part of the Tranche 4 certification state.**
- TypeScript typecheck: **PASS**. Changed-file ESLint: **PASS** (one pre-existing `Login.tsx` exhaustive-deps warning). Production build: **PASS** (only repository Browserslist/chunk-size warnings).
- Full lint remains a repository baseline failure outside this tranche; the boundary command is environment-blocked on Windows (`Bash/Service/CreateInstance/E_ACCESSDENIED`). `git diff --check` passes.
- Local Playwright was not run because the repository has no safe authenticated Buyer fixture and production mutation is unauthorized; rendered Buyer route coverage is included in the focused suite. Remote Release Quality/Playwright/ownership and service checks remain PR gates to observe.
- Mobile widths **375 px, 390 px and 430 px**: responsive implementation verified; authenticated runtime certification is explicitly deferred to APP-E2E Tranche 5. No authenticated mobile runtime claim is made here.

### Tranche 4 remaining upstream blockers

The following are intentionally not implemented in Central: customer-safe SO commercial projection/version detail beyond currently deployed fields; issued PI projection/number; final invoice and statement projection/downloads; Finance payment/wallet/credit facts; durable favourites; and governed general/non-order customer query. These remain Core/Finance authority gates, not hidden frontend defects.

## APP-E2E Tranche 5 — Central Buyer binding readiness (current census)

- **Current Central `main`:** `8d24c99464558ccfcd9ca0cb7be538025f7f638c` (2026-09-01)
- **Tranche 5 branch:** `codex/app-e2e-tranche5-central-binding`
- **Boundary:** read-only reconciliation and binding readiness for the existing
  Buyer frontend. No Core schema/RPC, Finance, WhatsApp, Factory, Trace, CRM
  or production changes are permitted in this tranche.
- **Tranche 3:** ✅ MERGED — PR #427, merge SHA
  `d73db427027b542dafa436190078aee8c48078a1`.
- **Tranche 4:** ✅ MERGED — PR #431, merge SHA
  `8d24c99464558ccfcd9ca0cb7be538025f7f638c`.

The baseline and branch fields at the top of this historical ledger retain
their original Tranche 4 evidence. The current-main and Tranche 5 branch
above are the authoritative values for this readiness census.

### Central implementation status

| Area | Status | Current evidence |
|---|---|---|
| Established Buyer route tree, mobile shell and auth guards | VERIFIED DONE | `src/App.tsx`, `BuyerApp` and the existing Buyer rendered/auth suites cover the current customer routes and fail-closed route handling. |
| Established customer client boundary | VERIFIED DONE | `customerAppClient` exposes the deployed Buyer RPC family only; backend failures are normalized to customer-safe copy. |
| Active customer writes | VERIFIED DONE | Current Buyer code has no direct `insert`, `update`, `delete`, `functions.invoke`, `fetch` or hard-coded mutation endpoint. Draft/cart, access-request, checkout and order-linked support mutations use the governed client wrappers. |
| Legacy customer writers | VERIFIED DONE | `SupportChat` and `CheckoutModal` are absent from current main; repository tests guard against their return and no import, route or CTA reaches them. |
| New Tranche 5 frontend defect | VERIFIED DONE | No independent Central defect was found that can be corrected without inventing an upstream authority. No Central implementation change was made. |

### Upstream production binding status

Statuses in this table are deliberately limited to `VERIFIED DONE`, `PARTIAL`,
`CORE BLOCKED`, `FINANCE BLOCKED` and `RUNTIME CERTIFICATION BLOCKED`.

| Capability | Status | Evidence / boundary |
|---|---|---|
| Canonical SO number | CORE BLOCKED | The established submit response returns an exact order reference, but the approved allocator/sequence authority is not present in protected production. Central never predicts or constructs a number. |
| SO commercial/version facts | CORE BLOCKED | `customer_sales_order_commercial_facts_v1` is absent from production; the versioned customer-safe projection cannot be bound. |
| SO value | PARTIAL | Existing status/submit contracts provide an order value; the complete immutable/versioned commercial snapshot remains Core-blocked. |
| Advance required | PARTIAL | Existing submit response provides `advance_required`; a deployed customer-safe projection for the full frozen commercial/Finance basis is not evidenced. |
| Payment facts | FINANCE BLOCKED | No exact customer-safe payment projection is deployed. Internal `get_order_payment_facts_v1` is not a Buyer substitute. |
| Wallet facts | FINANCE BLOCKED | No deployed customer-safe wallet projection is evidenced. |
| Credit facts | FINANCE BLOCKED | No deployed customer-safe credit projection is evidenced. |
| Finance Operations Clearance | FINANCE BLOCKED | Internal clearance authority is not a customer-safe Buyer projection. |
| PI state | CORE BLOCKED | `customer_proforma_invoice_facts_v1` is absent; the internal PI authority does not provide a Buyer-safe read contract. |
| PI canonical number | CORE BLOCKED | The customer-safe allocator/numbering contract is absent from production; no number may be invented or predicted. |
| Final invoice state | FINANCE BLOCKED | No exact Buyer-safe final-invoice projection is deployed. |
| Customer documents | CORE BLOCKED | `customer_documents_v1` is absent from production. |
| Customer statement | CORE BLOCKED | `customer_statement_v1` is absent from production. |
| Durable favourites | CORE BLOCKED | No governed favourite RPC is present; legacy `public.user_favorites` is not an approved Buyer authority. |
| General/non-order query | CORE BLOCKED | No order-optional customer query contract is deployed; order-linked support must not be repurposed. |
| Existing order-linked support | VERIFIED DONE | `customer_support_tickets_v1` and `submit_customer_support_ticket_v1` are deployed and wrapped by `customerAppClient`. |
| Requested dispatch | VERIFIED DONE | Existing checkout/status contracts carry the requested dispatch value. |
| Promised dispatch | VERIFIED DONE | `customer_order_status_v1` carries the promised dispatch value when available. |
| Buyer order status | VERIFIED DONE | `customer_order_status_v1` is the deployed customer-safe status projection. |
| Dashboard action-required state | PARTIAL | Current payment-stage action labels are rendered safely; richer Finance-backed action state awaits the customer-safe Finance projection. |

### Exact production/Core reconciliation

The protected production Supabase project `tcxvcatsqqertcnycuop` is
`ACTIVE_HEALTHY`, but its migration ceiling is `20260901004600`. The exact
Tranche 5 Core migrations (`20260901005000` through `20260901005300`) are not
deployed. Consequently the following exact customer-facing contracts are
absent from production: `customer_sales_order_commercial_facts_v1`,
`customer_proforma_invoice_facts_v1`, `customer_order_finance_facts_v1`,
`customer_documents_v1`, `customer_statement_v1`, the customer favourites
RPC family, and the customer query RPC family. Similar internal JSON or
Finance functions are not substitutes and are not bound by Central.

Core PR #163 (`c93ce0f80a85ed2da0204ff11426832a28b755cf`) contains the proposed
authority migrations but remains open and blocked (`REVIEW_REQUIRED`) with
six unresolved CodeRabbit threads. Core PR #168 independently uses migration
version `20260901005000`, colliding with PR #163; this is recorded for Mission
Control/Core reconciliation and is not changed by Central.

An authenticated, non-production Buyer fixture suitable for a full golden path
was not available. Therefore authenticated runtime certification is
`RUNTIME CERTIFICATION BLOCKED`; no production order, ticket or other write was
performed.

### Tranche 5 local evidence

- Buyer/client/presentation/auth focused suite: **55/55 PASS**.
- TypeScript typecheck: **PASS**.
- Scoped ESLint over Buyer/client/presentation/auth files: **PASS**.
- Production build: **PASS** (repository Browserslist and chunk-size warnings
  only).
- Full `npm run test`: **FAIL — 281 test files passed, 5 failed (1,727 tests
  passed, 5 failed; 1,732 tests total)**.
  Every failure is in the out-of-scope WhatsApp governance surface
  (`whatsappContextualAliasReuseAuditMigration`,
  `whatsappAuthorizedChannelIntakeBoundaryMigration`,
  `operatorInboxBoundedLoadGuard`,
  `operatorInboxComposerReachabilityGuard`, and
  `operatorInboxStage1Guard`). No WhatsApp files were modified.
- Local Playwright authenticated certification: **RUNTIME CERTIFICATION
  BLOCKED** because no safe authenticated Buyer fixture exists and production
  mutation is unauthorized.

This full-suite result is an explicit cross-scope dependency, not a Buyer
frontend fix opportunity: **OUT-OF-SCOPE DEPENDENCY FOUND.**

### Tranche 5 disposition

**CENTRAL READY / CORE HANDOFF REQUIRED** — the established Buyer frontend is
ready for currently deployed contracts, no safe Central binding work remains
without the absent protected Core contracts, and no placeholder PR is created.
Tranche 5 remains **IN PROGRESS — UPSTREAM CONTRACT BINDING REMAINS**. The next
authorized step is protected Core reconciliation/deployment and authenticated
runtime verification, followed by a narrowly scoped Central contract-binding
change only after those exact contracts are verified in production.

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
| Order-linked support tickets and evidence | ✅ VERIFIED COMPLETE | Buyer Support and `SupportTicketModal` call Core `submit_customer_support_ticket_v1(...)`, require an order/description, and render customer-safe ticket projections. |
| General/non-order customer queries | ⛔ CORE CONTRACT REQUIRED | The established support submission contract requires `p_order_id`; no verified order-optional customer query writer is available. Central must not create a shadow table or route a non-order query into checkout. |
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
| General/non-order customer query inward | ⛔ CORE CONTRACT REQUIRED | Current governed Buyer support submission is order-linked and cannot safely represent arbitrary non-order queries without a separate owner-assigned contract. |
| Full Buyer → SO → Finance → Buyer golden path | BLOCKED | Awaiting protected Core deployment and authenticated production verification of the exact customer-safe contract. |
| Central owner action | NONE FOR CURRENT SLICE | Core/Mission Control must provide the deployment and runtime evidence; Central must not deploy or mutate production. |

## Exit gates

### Historical implementation progress (Tranches 1–3)

- [x] Dedicated APP-E2E branch created from current Central main.
- [x] Governed client wrappers added for Core buyer identity, pricing, draft/cart, checkout, order projections and order-linked support contracts.
- [x] Buyer route tree and mobile navigation shell added; buyer roles now land on `/buyer` when approved company context exists.
- [x] Catalogue search/filter/detail and Core-backed persistent cart added.
- [x] Checkout UI uses Core `submit_customer_order_v1` with a stable retry key; it does not calculate or write Finance state.
- [x] Order-linked support ticket modal/page uses Core submission RPC; direct customer audit-table writes removed from the active Buyer path.
- [x] Quick buy/reorder, catalogue/detail, cart/MOQ, checkout/order inward, order projections, order-linked support tickets, account context, alerts and Buyer loading/error/empty/mobile states were implemented and covered by the then-current Tranche 3 checks.
- [ ] General/non-order customer query inward requires a governed order-optional Core contract; do not create a Central shadow writer or SO.
- [ ] Durable favourites, statements, customer-safe documents and richer Finance-backed commercial cards remain blocked on Core contracts and/or protected runtime proof.
- [ ] Authenticated production golden-path verification remains outstanding.
- [x] Hosted Playwright PR smoke passed on the historical Tranche 3 takeover head.
- [x] Production presence for the established Buyer RPC set is verified; full authenticated Core runtime/golden-path certification remains pending as a separate Mission Control gate.

- [x] Buyer route tree and mobile shell are complete and connected to authenticated buyer context.
- [x] Catalogue/detail/cart use customer-safe Core contracts; MOQ/carton errors are actionable.
- [x] Submission uses only the governed Core checkout RPC with stable idempotency and retry-safe UI.
- [x] Orders/status/items and order-linked support are customer-safe projections with correct empty/loading/error states.
- [x] No authoritative Finance calculation or direct `orders`/`order_items`/support-table mutation remains in the Buyer path.
- [x] Required frontend regression coverage, typecheck, lint, production build and Playwright checks passed on historical Tranche 3 head `2930cb77d4f669d018ffc42129f52449b70c91d3`.
- [x] Tranche 1 and Tranche 2 software implementation/merges are complete; production presence is verified for the established Buyer RPC set.
- [ ] Any future surface that consumes a newer Core contract is held until that exact customer-safe contract is protected-deployed and verified in production.
- [ ] Final golden paths are demonstrated: authenticated buyer order inward to canonical SO/Finance handoff, plus a governed non-order support/query path once its Core contract exists.

### Runtime / upstream gate boundary

- [x] Protected production contract presence for the established Buyer RPC set is evidenced by the read-only inspection recorded above.
- [ ] Protected Core deployment/runtime verification for the newer Finance/document projections is evidenced by Mission Control.
- [ ] A governed order-optional customer-query contract is deployed/verified for non-order Buyer queries.
- [ ] Authenticated golden-path evidence proves Buyer → governed order inward → canonical SO → Finance-visible projection/review → Buyer-safe projection. The App code is ready for its currently contracted surfaces; this cannot be claimed from CI or a Vercel preview alone.

## Non-blocking later-stage gaps

Historical legacy defaults, broad legacy order normalization, and any additional provenance-copy cleanup are not part of this APP-E2E implementation unless current evidence shows a direct violation of the Buyer/Core contract.

## APP-E2E Tranche 5 — final Central binding evidence

This section supersedes the earlier Tranche 5 readiness disposition for the
newly deployed customer-safe Core contracts while preserving that census as
historical evidence above.

- Central base verified: `fc8509dfc4e0b0049a9b619b2550bc43000f94a0` (current
  `origin/main`, including merged WhatsApp stabilization #432).
- Working branch: `codex/app-e2e-tranche5-central-binding`.
- Core PR `#163`: **MERGED**.
- Core production SHA: `a922ff7f6f8294c09e623c07766a1357d997a9f7`.
- Protected production release run `33549338293`: **PASS** (pending migrations,
  post-deploy ledger, semantic parity and customer contract smoke).
- Read-only production inspection verified the exact customer RPC signatures,
  authenticated grants and anonymous denial for the new Buyer contracts. No
  production rows were created or changed by this work.

### Bound customer authority

| Capability | Central evidence | Runtime classification |
|---|---|---|
| SO number | Exact Core `order_number` is rendered; no local allocator or format generation exists. | CODED + TESTED; production contract shape verified |
| SO commercial/version facts | `customer_sales_order_commercial_facts_v1()` is typed, wrapped and merged into list/detail. | CODED + TESTED; production contract shape verified |
| SO value | Frozen Core value is displayed; checkout preview remains explicitly non-authoritative. | CODED + TESTED; production contract shape verified |
| Advance required | Core finance projection value is displayed without frontend percentage/rounding logic. | CODED + TESTED; production contract shape verified |
| Payment / wallet / credit / Finance clearance | Customer-safe JSON is normalized and shown only when `customer_safe_projection` is true. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| PI state/number | PI facts are bound; customer-visible number is shown only for `ISSUED`, never predicted. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| Final invoice / customer documents | `customer_documents_v1()` availability and returned identity are rendered without files or URLs being fabricated. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| Customer statement | Customer-safe statement facts and wallet balance are normalized; internal closure metadata is dropped. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| Durable favourites | Server read/write RPCs, optimistic rollback and post-write reconciliation are bound; no LocalStorage authority. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| General/non-order query | Separate Core query RPC with stable idempotency key; path never calls order submission or creates an `order_id`. | CODED + TESTED; authenticated Buyer runtime not evidenced |
| Order-linked support | Existing governed support-ticket path remains separate from general enquiry and checkout. | CODED + TESTED |
| Requested/promised dispatch | Commercial projection values replace stale status values when present. | CODED + TESTED; production contract shape verified |
| Buyer order status | List/detail/dashboard use bounded customer-safe labels and the same Finance status precedence. | CODED + TESTED |
| Dashboard action state | Finance action labels prefer customer-safe Core status and fail closed for unknown values. | CODED + TESTED |

### Verification record

- Focused Buyer/client/presentation suites: **PASS — 55 tests** (including
  current-head review remediation for order-scoped document/PI identities,
  last-known optional projections with refresh-generation protection, and
  non-blocking Finance/team fan-out).
- Changed-file ESLint: **PASS**.
- TypeScript (`tsc -p tsconfig.app.json --noEmit`): **PASS**.
- Production build (`npm run build`): **PASS** (existing Browserslist and chunk
  size advisories only).
- Pristine exact-main baseline (`8d24c99…`, clean `npm ci`): **5 known
  out-of-scope WhatsApp governance failures; 281 files / 1,727 tests passed**.
  This is retained as historical evidence from the prior main snapshot.
- Pristine current-main baseline (`fc8509df…`, clean `npm ci` in a detached
  worktree): **5 known out-of-scope WhatsApp governance failures; 1,737 tests
  passed**. The failing files are the same five listed below.
- Current-main-aligned Tranche 5 full suite (`fc8509df…`): **5 identical
  out-of-scope WhatsApp governance failures; 1,753 tests passed**. No Buyer
  failure reproduced; the five failing test files are unchanged from the
  known WhatsApp baseline.
- Boundary review: no Core migration, schema, WhatsApp, Finance, Factory,
  Dispatch, Trace or CRM files were changed. Full boundary script is not
  executable in this Windows sandbox because Bash is unavailable.

### Authenticated runtime gate

The Core production authority and protected deployment are closed, but an
authenticated Buyer golden-path run is **NOT EVIDENCED**. Repository and CI
inspection found no sanctioned Buyer storage state or documented synthetic
fixture; `CUSTOMER_EMAIL`/`CUSTOMER_PASSWORD` secret names are not referenced
by a Buyer certification workflow. Local Supabase CLI/Docker is unavailable,
and production mutation is unauthorized. Therefore mobile 375/390/430 runtime
certification and the complete authenticated Buyer → SO → Finance → PI →
documents/statement path remain a release gate, not a software defect.

**Tranche 5 status: SOFTWARE READY — DISPOSABLE BUYER GOLDEN-PATH CERTIFICATION WIRED.**

Authenticated runtime evidence is produced by
`.github/workflows/buyer-golden-path-certification.yml` against a synthetic Buyer
fixture in an isolated local Core replay. See `docs/APP_E2E_BUYER_SYNTHETIC_FIXTURE.md`.

Owner/Mission Control action required only for **manual preview** runs against a
non-loopback Vercel deployment: supply repository secrets
`TEST_PREVIEW_URL`, `TEST_BUYER_EMAIL`, and `TEST_BUYER_PASSWORD` for a separate
non-production tenant. Disposable CI generates credentials automatically and never
touches production.
