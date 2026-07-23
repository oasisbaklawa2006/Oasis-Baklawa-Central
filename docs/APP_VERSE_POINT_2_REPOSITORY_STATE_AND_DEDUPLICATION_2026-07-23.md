# App-Verse Point 2 — Repository State, Deduplication and Soft-Launch Gate

**Date:** 2026-07-23  
**Scope:** Oasis-Baklawa-Central, oasis-ai-studio, oasis-trace, oasis-baklawa, oasis-supabase-core  
**Method:** GitHub repository metadata, recent PRs/commits, existing repository audits and current programme register. No production write, schema change, module deletion or deployment was performed.

## 1. Point 2 outcome

The five active App-Verse repositories are confirmed:

1. `oasisbaklawa2006/Oasis-Baklawa-Central`
2. `oasisbaklawa2006/oasis-ai-studio`
3. `oasisbaklawa2006/oasis-trace`
4. `oasisbaklawa2006/oasis-baklawa`
5. `oasisbaklawa2006/oasis-supabase-core`

Two empty repositories, `clone-oasis-baklawa-central` and `cursor-vercel`, are not App-Verse application authorities and must not be treated as sixth/seventh product repositories.

## 2. Reconciliation rule applied to the 1–100 register

The master sequence is a completion programme, not a list of assumptions. Each point must be interpreted as follows:

- already merged and proven work is credited as an existing baseline and is not rebuilt;
- partially completed work retains only its missing acceptance criteria;
- open/draft PR work is not counted complete until merged, validated and accepted;
- duplicated modules are not both completed; one canonical winner is selected and the other is migrated, frozen, redirected, archived or deleted after dependency proof;
- demo, preview and projection-only interfaces are not accepted as completed operational modules;
- deletion occurs only after canonical parity, dependency search, data migration, route redirect, UAT and rollback evidence.

## 3. Repository state and work already completed

### 3.1 Oasis-Baklawa-Central

**Current maturity:** broad operational application with live legacy modules, extensive WhatsApp governance work, partial next-generation execution/governance boards, and multiple duplicated authorities.

**Already completed and not to be rebuilt:**

- broad customer storefront and internal admin route foundations;
- live legacy order, production, assembly, ready-goods, finance and dispatch operations;
- Central repository ownership guardrails and screen registry work;
- WhatsApp canonical-domain and zero-loss governance documentation;
- numerous merged WhatsApp accountability, reconciliation, stale-item, integrity, attention and team-summary read models;
- test-environment Supabase bootstrap repair;
- tracked `.env` removal and `.gitignore` correction;
- modal-layering repairs in Assembly and Ready Goods;
- Central-side signed barcode ingest contract work paired with Trace.

**Still pending:**

- canonical WhatsApp packet/draft to live order conversion;
- one order-intake authority;
- canonical finance, inventory, production, packing, dispatch and gate authority;
- automatic queue seeding;
- live scan/event stitching;
- complete CRM;
- complete management mobile, handheld and Smart TV surfaces;
- retirement of parallel legacy/governance/demo modules after parity.

**Current blocker/open work:** PR #292 quarantines 47 undeployed `whatsapp_business_intakes` migrations and remains open. These migrations must stay outside the live deployment lane. The duplicate timestamp inside the archived set must be corrected before any future reactivation.

### 3.2 oasis-ai-studio

**Current maturity:** advanced and substantially stabilised product/catalogue application. Production capability alignment, operational workspace, governed catalogue AI gateway and extensive tests are already present.

**Already completed and not to be rebuilt:**

- production capability contract alignment;
- Fast Create and Full Editor foundations;
- active Product Studio, media, approval and catalogue workspaces;
- repository boundary controls;
- route lazy loading and bundle reduction;
- exact-SHA deployment audit protection;
- role-bootstrap deduplication and retry hardening;
- operational AI Studio workspace and module-purpose guidance;
- governed `catalogue-ai-copy` gateway and smoke-test contract;
- production-safe unavailable/on-hold states for absent backend capabilities;
- broad automated test foundation.

**Still pending:**

- finish missing Full Editor fields and canonical aggregates rather than rebuild existing editors;
- consolidate competing catalogue creation models;
- canonical pack/carton/hamper/BOM/label models;
- mobile product creation and launch;
- guided controlled photography and AI enhancement;
- publication contracts and cross-app projections;
- UAT for write paths and previously unavailable modules.

### 3.3 oasis-trace

**Current maturity:** useful barcode/label/scan prototype with some live Central integration, but not yet the complete physical identity authority.

**Already completed and not to be rebuilt:**

- scan-contract helpers;
- CTN-SO barcode generation/parsing and Central payloads;
- idempotency baseline;
- safe Edge Function Central submission architecture;
- HMAC binding to idempotency key and payload;
- repository ownership guardrails;
- hard failure on live Supabase write failure;
- operator-visible error handling across production entry, gate scan and cartonisation;
- baseline typecheck/build/test suite.

**Still pending:**

- canonical product/batch/pack/carton identity;
- production-grade label and print queue;
- full scan ingestion and offline replay;
- all departmental handovers;
- device health and forensic timelines;
- Central inventory/status consequences;
- real production UAT;
- retirement of demo/local-only authority.

### 3.4 oasis-baklawa customer app

**Current maturity:** new mobile repository with two parallel draft implementations.

**Already completed and not to be rebuilt:**

- governed customer-contract boundary;
- initial Vite customer gateway in PR #1;
- Expo/React Native/Expo Router foundation in PR #2;
- iOS and Android identifiers;
- mobile-safe Supabase session persistence;
- Welcome, sign-in, business-registration presentation and approved-buyer tab foundation;
- native catalogue and order screens;
- governed order detail/timeline;
- governed support history and submission;
- boundary checks preventing raw operational-table access;
- Mobile Quality workflow.

**Still pending:**

- approval-state contract/routing;
- product detail with buyer pricing, MOQ and carton rules;
- cart, Quick Order and Order Desk;
- governed order-submission RPC;
- accounts/payments/documents/dispatch/support depth;
- offline and physical-device UAT;
- complete frozen customer UI implementation.

### 3.5 oasis-supabase-core

**Current maturity:** young governance/schema repository with important production migrations already applied but several governing PRs still open/draft.

**Already completed and not to be rebuilt:**

- governed catalogue-copy Edge Function source contract;
- production `published_products_v1` migration;
- production `buyer_product_prices_v1` migration;
- production `customer_order_status_v1` migration;
- production `customer_order_items_v1` migration;
- production support-ticket ownership/RLS hardening;
- customer support read/submit contracts;
- initial App-Verse ownership/entity/customer-contract documentation.

**Still pending:**

- merge and reconcile open PRs #6–#12;
- make the repository the formal migration/contract authority;
- canonical entity, role, event, audit and integration contracts;
- schema drift and migration CI;
- reconcile frontend-repository historical migrations;
- freeze duplicate tables and remove only after proof;
- environment, backup and disaster-recovery governance.

## 4. Canonical duplicate selection register

| Capability | Duplicate/parallel implementations | Canonical winner | Required treatment of duplicates |
|---|---|---|---|
| Customer mobile app | Vite PR #1 and Expo PR #2 | Expo/React Native PR #2 | Keep PR #1 as temporary functional reference; port any superior missing behavior, then close/archive it. Do not merge both apps. |
| WhatsApp business intake | Live Central lane and 47 undeployed `whatsapp_business_intakes` migrations | Existing live Central WhatsApp/operator lane | Merge quarantine PR #292 after review; archived lane is reference-only and must not deploy. |
| Sales-order draft | Central live/staging draft flow and disconnected parallel intake concepts | Central canonical order-intake service | Migrate useful validation only; remove parallel writer authority. |
| Finance | Legacy Finance/Admin Accounts screens and Finance Governance Board | One Central Finance Command service using live proven writes plus governed evidence | Preserve working legacy behavior during migration; governance board remains read-only until parity, then redirect and retire duplicate routes. |
| Dispatch | Packing/Dispatch legacy screens, dispatch governance boards, execution board | One Central Dispatch Command chain | Select proven live write path as interim authority; absorb readiness/evidence features; retire preview and duplicate writers after parity. |
| Production | Legacy production tabs and department execution boards | Central department execution model backed by one queue/event service | Seed execution queues from canonical orders, migrate usable legacy actions, then retire duplicate state writers. |
| Catalogue creation | Dashboard/Catalogues flow and Admin Catalogue Builder | AI Studio canonical Catalogue Version aggregate | Migrate data/features into one model; retire competing creation route with compatibility redirect. |
| Product master | Central product CRUD and AI Studio product authoring | AI Studio editorial/product authority; Central consumes published operational projection | Central retains operational overrides only where explicitly governed; remove duplicate authoring authority. |
| Label capability | AI Studio label data, Central Label Command Center, Trace label/print UI | AI Studio owns label content; Central commands; Trace prints/verifies | Delete no useful feature; separate ownership, then remove demo label authority from Central. |
| Physical carton/scan | Central Carton Explorer/Scan Timeline previews and Trace | Trace physical evidence authority | Central embeds Trace projections; retire synthetic Central scan/carton data. |
| Support tables | `support_tickets` and duplicate `tickets` | `public.support_tickets` | Keep `tickets` frozen with no browser authority; migrate any dependency, then delete only after zero-dependency proof. |
| Customer contracts | Direct table access and Core v1 RPC projections | Supabase Core governed v1 contracts | Customer app must use RPC contracts; direct operational-table access stays blocked. |
| Hamper/BOM/pack models | Multiple product/hamper/BOM structures | One AI Studio product composition and packaging aggregate | Reconcile fields/data before retiring alternate models. |

## 5. Deletion policy

“Delete duplicates” does not mean immediate code/file/table deletion. A duplicate is deleted or retired only after:

1. canonical owner selected;
2. feature and data comparison completed;
3. superior missing features migrated;
4. all code, SQL, workflow and runtime references searched;
5. production data dependency proven zero or migrated;
6. route/API compatibility redirect provided where needed;
7. tests and UAT pass;
8. rollback/archive evidence exists;
9. UI no longer presents duplicate authority;
10. deletion is performed in a separately reviewable change.

## 6. Adjustments to the 1–100 interpretation

The following programme points are **completion/enhancement points**, not greenfield rebuilds:

- Points 26–31: preserve existing AI Studio Fast Create, Full Editor and production renovation; complete only missing scope.
- Points 41–50: extend existing media/AI foundations; do not replace working media modules without evidence.
- Point 57: use the existing Central module-reality audit as baseline and update deltas only.
- Points 65–68: build on merged WhatsApp identity/accountability/reconciliation work; do not repeat those read models.
- Points 87–92: consolidate live legacy operational functions with execution boards rather than create third implementations.
- Points 94–96: build on Trace CTN-SO, HMAC, idempotency and write-failure hardening.
- Point 100: build the missing customer-app scope on Expo PR #2; do not start a third frontend.

## 7. Controlled soft-launch gate

### SOFT LAUNCH GATE SL-1 — immediately after Point 98

Point 98 is the earliest honest sequence marker because, by then:

- WhatsApp intake and live-order conversion are complete (Points 65–70);
- Central order command is complete (Points 71–76);
- finance is canonical and usable (Points 77–81);
- inventory and production through packing are complete (Points 82–92);
- minimum Trace contract, identities, scans and handovers are complete (Points 93–97);
- dispatch, finalisation and gate release are complete (Point 98).

SL-1 additionally requires these launch-critical capabilities to have been completed early under their parent points, even though final App-Verse launch remains Point 100:

- AI Studio has enough approved/published products for launch through Points 54–56;
- customer Expo app has authentication, approved-buyer routing, catalogue, product detail, Order Desk/order submission, orders, accounts/documents and support minimums;
- WhatsApp zero-loss acceptance passes with no silent order loss;
- Central has no demo/preview screen acting as production authority;
- production data backups and rollback plan exist;
- security, permissions and controlled UAT pass for launch roles;
- initial launch users, products, departments and order volume are deliberately bounded.

### SL-1 meaning

SL-1 is a **controlled real-customer soft launch**, not final programme completion. Points 99 and 100 continue afterwards for complete embedded Trace surfaces, full cross-app parity, broad UAT, performance, accessibility, disaster recovery and formal production acceptance.

## 8. Point 2 acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 2a | Confirm the five authoritative repositories | COMPLETE |
| 2b | Review current branches/open PR direction and known blockers | COMPLETE |
| 2c | Reconcile pending list against already completed work | COMPLETE |
| 2d | Identify duplicate/parallel modules | COMPLETE |
| 2e | Select canonical winners and retirement treatment | COMPLETE |
| 2f | Define safe deletion policy | COMPLETE |
| 2g | Mark controlled soft-launch stage | COMPLETE |
| 2h | Record remaining evidence limitations | COMPLETE |

## 9. Evidence limitations and next verification

This point establishes repository-level programme truth from GitHub and existing audits. It does not claim every open PR is merge-ready, every production migration matches source `main`, or every deployment is healthy at this exact moment. Those are handled by their relevant execution points and must be reverified immediately before merge/deploy/launch.
