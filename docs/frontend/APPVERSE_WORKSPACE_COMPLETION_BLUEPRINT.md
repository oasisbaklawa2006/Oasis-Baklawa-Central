# App-Verse Workspace Completion Blueprint

Status: implementation-independent planning baseline

This document is intentionally independent of PR #319. It is derived from the currently registered `main` routes and the approved App-Verse product direction. It does not change schema, RLS, Edge Functions, authentication, production authority, or route behavior.

## Governing rule

Backend defines business truth: entities, states, authority, transitions, approvals, audit and write contracts.

Frontend defines presentation: role-specific attention, queues, summaries, next actions, drill-down, responsive behavior and display surfaces.

The seven App-Verse workspaces are presentation containers only and must not become database domains.

## Completion sequence

1. Home / role command view
2. Orders & Finance
3. Operations / Production / Stores
4. Customers / WhatsApp / Support
5. Trace / Dispatch
6. Products / Catalogue integration links
7. Governance / administration
8. Device-specific mobile, handheld and TV surfaces
9. Cross-app Central / AI Studio / Trace identity and navigation integration
10. End-to-end UAT and release certification

## Existing route consolidation matrix

`docs/frontend/APPVERSE_ROUTE_DISPOSITION_MATRIX.md` is the authoritative disposition source. The sections below group routes for planning narrative only. Where a route is marked CONSOLIDATE, SPECIALIST, or BLOCKED-BY-BACKEND in the disposition matrix, it is not a daily primary navigation surface even if it remains operationally important.

Disposition labels used in both documents:
- KEEP, SIMPLIFY, CONSOLIDATE, SPECIALIST, LINK-OUT, BLOCKED-BY-BACKEND

### Home

Primary destination: `/admin`

Deep analytical destination retained: `/admin/heartbeat`

Home must become role-first rather than a universal executive dashboard. It should show only the user's important signals, queues, alerts and next actions. Executive analytics remain available as a deeper view for eligible roles.

### Customers & Sales

Primary canonical surfaces (KEEP / SIMPLIFY):
- `/admin/clients`
- `/admin/operator-inbox`
- `/admin/support`
- `/admin/customer-timeline-preview`
- `/admin/operational-search`

Specialist / exception surfaces:
- `/admin/exceptions` (SPECIALIST)
- `/admin/sales-hub` (SPECIALIST)

Compatibility routes (CONSOLIDATE):
- `/admin/customers` -> clients
- `/admin/crm` -> clients
- `/admin/central-pool` -> operator inbox
- `/admin/cmd-war-room` -> operator inbox
- `/admin/whatsapp` -> operator inbox
- `/admin/approvals` -> customer/access approval mode within customer context

UX target: one customer context, one attention queue, one communication timeline, one support/exception flow. Do not duplicate the same customer state across separate competing screens.

### Orders & Finance

Primary canonical surfaces (KEEP / SIMPLIFY):
- `/admin/order-management`
- `/admin/accounts-release`
- `/admin/finance`
- `/admin/pricing`
- `/admin/moq`
- `/admin/currency`

Specialist surfaces:
- `/admin/finance-board` (SPECIALIST)
- `/admin/finance-governance` (SPECIALIST)

Compatibility routes (CONSOLIDATE):
- `/admin/orders` -> legacy/general order list compatibility
- `/admin/finance/payments` -> finance
- `/admin/finance/invoices` -> finance

UX target: the order is the central object. Commercial status, advance, invoice, final balance, finance release and exceptions should be visible in one order-centric sequence. Separate specialist boards may remain, but they should feel like filtered views of the same commercial truth.

### Operations

Primary canonical surfaces (KEEP / SIMPLIFY):
- `/admin/execution-command-center`
- `/admin/execution/production`
- `/admin/execution/assembly`
- `/admin/execution/ready-goods`
- `/admin/execution/dispatch`
- `/admin/execution/third-party`
- `/admin/execution/retail`
- `/admin/inventory-command-center`
- `/admin/store-coordination`
- `/admin/3pcs-store`

Specialist surfaces:
- `/admin/execution-risk` (SPECIALIST)
- `/admin/execution-bottlenecks` (SPECIALIST)
- `/admin/reservation-board` (SPECIALIST)
- `/admin/inventory-risk-board` (SPECIALIST)

Compatibility / consolidated routes:
- `/admin/live-work-queues` (CONSOLIDATE -> command center queue lens)
- `/admin/ready-goods` (CONSOLIDATE)
- `/admin/assembly-tasks` (CONSOLIDATE)
- `/admin/production` (CONSOLIDATE)
- `/admin/operations` (CONSOLIDATE)
- `/admin/inventory` (CONSOLIDATE)
- `/admin/department` (CONSOLIDATE)

Blocked-by-backend write surfaces:
- `/admin/stock-finalization` (BLOCKED-BY-BACKEND)

UX target: execution-first. Each operational role sees current work, blockers, shortages, overdue actions and the next valid transition. Management sees cross-department bottlenecks; operators see only the work they can execute.

### Products & Catalogue

Primary Central surfaces:
- `/admin/products`
- `/admin/merchandising`
- `/admin/catalogue-sync`
- `/admin/catalogue-approvals`

UX target: Central shows operational product context and publication/sync status. AI Studio remains the product/editorial authority. Avoid rebuilding AI Studio inside Central.

### Trace & Dispatch

Primary canonical surfaces (KEEP / SIMPLIFY):
- `/admin/scan-timeline`
- `/admin/carton-explorer`
- `/admin/label-command-center`
- `/admin/dispatch-readiness`
- `/admin/dispatch-completion`
- `/security-gate`

Blocked-by-backend write surfaces:
- `/admin/dispatch-finalization` (BLOCKED-BY-BACKEND)
- `/admin/golden-chain-operator` (BLOCKED-BY-BACKEND)

Compatibility / consolidated routes:
- `/admin/dispatch-mgmt` (CONSOLIDATE)
- `/admin/packing-dispatch` (CONSOLIDATE)
- `/admin/dispatch` (CONSOLIDATE)
- `/admin/execution/dispatch` (SIMPLIFY canonical execution board; listed under Operations)

UX target: one physical chain from packed goods -> labels/cartons -> readiness -> handover -> gate -> dispatch completion. Trace remains the specialist traceability application; Central should link to evidence rather than duplicate trace internals.

### Governance

Primary canonical surfaces (KEEP):
- `/admin/users`
- `/admin/settings`
- `/admin/notifications`
- `/admin/announcements`
- `/admin/display-management`
- `/admin/logistics`

Specialist surfaces:
- `/admin/audit` (SPECIALIST)
- `/admin/entity-graph-explorer` (SPECIALIST)

UX target: infrequent administrative functions stay out of daily navigation. Governance should be search/drill-down oriented, with dangerous actions separated from ordinary settings.

## Screen simplification rules

1. One primary action per state where possible.
2. Secondary actions move into context menus or detail drawers.
3. Tables are for scan/compare work; cards are for attention/decision work.
4. Do not expose a field simply because it exists in the database.
5. Default view should answer: what needs my attention now?
6. Every warning must explain why it exists and the next valid action.
7. Every status must have an identifiable source of truth and timestamp.
8. Keep audit/evidence accessible within three clicks without making it visually dominant.
9. No role sees controls it cannot execute.
10. No write control is designed before the backend thread defines its contract and authority.

## Readiness states for each screen

Each screen must eventually be classified as one of:

- KEEP: current structure is already fit for purpose; apply design-system polish only.
- SIMPLIFY: same backend capability, lower interaction complexity.
- CONSOLIDATE: capability moves into a stronger canonical screen; old route remains compatibility-only until retirement.
- SPECIALIST: retain as a deep operational/audit tool, not primary navigation.
- LINK-OUT: authority belongs to AI Studio or Trace; Central provides context/deep link only.
- BLOCKED-BY-BACKEND: visual structure can be designed but write behavior waits for schema/contract finalization.

## Stop condition before implementation dependency on #319

Work may proceed independently through inventory, UX specification, screen-state definitions, component contracts, data-source placeholders and device matrices.

Implementation must pause once a change needs any of the following from PR #319:
- the App-Verse workspace rail,
- role-aware Home registry,
- shared App-Verse route authority,
- App-Verse theme scope,
- App-Verse application registry,
- or the new `/admin` Home composition.

At that point PR #319 must be merged/rebased into the implementation branch first.
