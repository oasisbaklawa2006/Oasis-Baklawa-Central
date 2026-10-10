# ASM-OC-01 — Oasis Connect routing

**ASM-ID:** `ASM-OC-01`  
**THREAD-ID:** `oasis-connect-20260920`  
**PROGRAMME ANCHOR:** `Point 54a`  
**CONTROL REPOSITORY:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**IMPLEMENTATION REPOSITORIES:** `oasisbaklawa2006/oasis-supabase-core`, `oasisbaklawa2006/oasis-ai-studio`, `oasisbaklawa2006/Oasis-Baklawa-Central`, `oasisbaklawa2006/oasis-trace`

## Mission

Build a governed plug-and-play product/channel distribution layer so a website, B2C app, B2B app, WhatsApp catalogue, Trace label engine or future consumer can connect to one approved Oasis product source through consumer identity, scoped tokens, channel profiles, publication versions and authority-preserving projections.

The system must make ordinary onboarding configuration-driven rather than bespoke development: create/clone consumer, select profile, issue scoped token, test/preview, activate. Consumers must never gain fields or authority by client-controlled query flags.

## Canonical architecture

- Core/Central remain canonical operational and commercial authorities.
- AI Studio remains catalogue/product-intelligence, approved presentation, publication/version and Oasis Connect configuration/projection UX authority.
- Trace remains physical print/reprint/scan/device/evidence authority.
- Mission Control owns sequencing and cross-repository routing.
- Oasis Connect may compose governed projections; it must not create a second product master or shadow transactional authority.

## Reuse requirements

Before creating new contracts, implementation must reuse or wrap existing canonical contracts where applicable, including:

- Core `published_products_v1()` as the base customer-safe product projection;
- Core `buyer_product_prices_v1()` as the existing commercial-overlay precedent;
- AI Studio catalogue snapshot/version and channel-pricing/channel-rule contracts;
- existing Trace printer/reprint authority, including governed reprint approval and printer identity;
- existing Core audit/idempotency patterns rather than parallel ungoverned logging.

## Work stages

### CONNECT-1 — census and contract freeze

Read-only cross-repository census; authority matrix; reusable-contract inventory; consumer/profile/field-authority design; Trace-label bridge design; security/test plan. No production mutation.

### CONNECT-2 — Core consumer/token/projection authority

Core-owned persistence/RLS/RPC/Edge contract for consumer identity, token hashing/revocation/scopes, profile binding, projection authorization, audit/idempotency, rate limits and safe public API surface. Must be separately routed to Core before implementation/deployment.

### CONNECT-3 — AI Studio configuration engine

AI Studio-owned Connections/Profiles/Projections/Tokens/Webhooks/Labels/Activity UX, predefined B2C/B2B/website/WhatsApp/Trace profiles, payload preview, test connection, clone/version/rollback experience and mapping UI. No shadow backend authority.

### CONNECT-4 — Central commercial projection binding

Read and bind Central/Core commercial truth for allowed projections without copying price/MOQ/customer terms into AI Studio authority. Requires a deeper Central commercial-boundary census before mutation.

### CONNECT-5 — Trace label bridge

Resolve approved label-safe product/template data through Oasis Connect while preserving Trace's existing printer/reprint/scan/execution authority. Immutable print-manifest/evidence linkage may be added only in the owning backend contract and must not bypass current Trace governance.

### CONNECT-6 — consumer adapters and certification

Bind/test the B2B Buyer App, future B2C projection, websites, WhatsApp catalogue and Trace label client. Certify isolation, versioning, rollback, security, runtime and physical-device gates where applicable.

## Authorized actions under early dependency exception

- read-only repository census;
- architecture/contract design;
- repository-local non-production code/tests after that repository has an explicit routed implementation item;
- consumer/profile/mapping/token UX design;
- test-plan and UAT preparation;
- draft PRs and exact-head CI/review.

## Prohibited actions

- production migration/deployment merely to prove functionality;
- cross-repository mutation without an owning route;
- shadow Core schema or duplicate product master;
- moving pricing/MOQ/order/inventory authority into AI Studio;
- moving print/reprint authorization out of Trace/Core governance;
- plaintext persistent consumer secrets;
- client-selected privilege expansion;
- declaring Point100, Production Readiness or APPVERSE COMPLETE from this ASM.

## Production safety

For every production-capable action, verify exact repository SHA and exact-head CI, inspect production read-only, identify mutation/blast radius/rollback/dependency order/environment/secrets, apply only the minimum governed mutation, then verify post-state, security, smoke and reconciliation evidence.

`PR MERGED != STAGE CLEARED`.

## Stop condition

Return control to Mission Control when Oasis Connect is software-complete across its routed repository scopes, required exact-head tests/security checks are green, consumer projections are isolated and versioned, existing Core/Central/Trace authority remains intact, website/app/WhatsApp/Trace adapter contracts are proven as far as authorized, and remaining blockers are only explicit protected-production, external-credential or physical-device gates.

Valid terminal status:

`ASM-OC-01 — OASIS CONNECT SOFTWARE & INTEGRATION COMPLETE`

or:

`ASM-OC-01 — OASIS CONNECT SOFTWARE COMPLETE — BLOCKED ONLY BY: <exact external gates>`
