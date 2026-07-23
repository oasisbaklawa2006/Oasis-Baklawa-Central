# App-Verse Point 4 — Frozen Repository Ownership Boundaries

**Date:** 2026-07-23  
**Status:** FROZEN  
**Authority:** This document supersedes older generic four-repo ownership descriptions where they conflict with the five-repository App-Verse architecture.

## 1. Governing principle

Each business truth has one primary owner. Other repositories may consume governed projections, issue commands, or display contextual views, but must not create a competing authority.

> Independent experiences, shared operational truth.

## 2. Repository authority matrix

| Repository | Primary authority | May consume | Must not own |
|---|---|---|---|
| `oasis-baklawa` | Customer-facing buyer experience | Published products, buyer prices/MOQ, customer-safe orders, accounts, documents, support and dispatch projections | Product authoring, internal manufacturing state, raw scans, direct operational tables, service-role logic |
| `Oasis-Baklawa-Central` | Operational command, CRM, order processing, finance, inventory consequences, manufacturing, packing, dispatch, gate and management control | Published product truth from AI Studio; physical evidence from Trace; shared contracts from Core | Full editorial product authoring, raw barcode identity authority, independent schema ownership, customer-app presentation ownership |
| `oasis-ai-studio` | Product intelligence, editorial product truth, catalogue composition, governed media, photography, packaging/variant readiness and publication | Shared identities/contracts from Core; operational feedback where needed | Orders, finance, stock movement, dispatch, gate, CRM operations, barcode movement evidence |
| `oasis-trace` | Physical identity, labels/printing execution, scans, cartonisation, handovers, movement evidence and trace forensics | Expected work and authorised movements from Central; published product identity from AI Studio/Core | Finance approval, inventory balance authority, product-commercial authoring, customer CRM, order-state authority |
| `oasis-supabase-core` | Shared schema, migrations, RLS, Edge Functions, shared RPCs, contracts, event/audit primitives and backend governance | Requirements from all application repos | Customer UI, Central admin UI, AI Studio UI, Trace handheld UI, duplicate business workflows |

## 3. Detailed ownership

### 3.1 Customer App — `oasis-baklawa`

Owns:

- mobile buyer authentication and onboarding presentation;
- approved/pending/rejected customer routing;
- premium customer dashboard;
- published catalogue presentation;
- customer-safe product detail;
- buyer-specific price, MOQ and order increments;
- Order Desk, quote request and governed order submission;
- customer-safe order status and item views;
- accounts, statements, documents and payment projections;
- dispatch/tracking projection;
- customer support and Selling Support;
- branch/team self-service within governed permissions;
- push/in-app customer notifications.

May write only through approved customer-safe RPCs/commands.

Forbidden:

- direct reads/writes to operational product, order, finance, inventory, production, scan or support tables;
- service-role credentials;
- internal staff interfaces;
- raw Trace scans;
- unpublished AI Studio drafts.

### 3.2 Central — `Oasis-Baklawa-Central`

Owns:

- CRM and Customer 360;
- company/branch/contact operational management;
- WhatsApp, portal, sales and manual order intake;
- canonical order lifecycle and state transitions;
- commercial validation and exception control;
- finance review, hold, release and exposure;
- inventory consequences and reservations;
- production command and departmental queues;
- assembly, ready goods and third-party store operations;
- packing command and carton requirements;
- dispatch readiness, loading, finalisation and gate release;
- support/complaint operations;
- CMD, management, reports, audit and global operational search;
- role-specific desktop/mobile control;
- Smart TV command projections.

Central may retain operational product fields only as a published projection or explicit operational override with audit. It does not own full product/editorial creation.

Forbidden:

- rebuilding AI Studio product editor/media studio;
- generating independent product truth outside approved publication contracts;
- fabricating physical scan evidence;
- owning new shared migrations/RLS/Edge Functions after Core authority is active;
- exposing raw internal states directly to customers.

### 3.3 AI Studio — `oasis-ai-studio`

Owns:

- product creation and enrichment;
- product/variant hierarchy;
- pack, inner-pack, carton and pallet definitions;
- ingredients, allergens, storage, shelf life and dimensions;
- MOQ/lead-time/catalogue-readiness editorial inputs;
- packaging and label-content readiness;
- AI descriptions, translations and selling content;
- governed photography capture, prompts, enhancement and image families;
- media workspace and derivatives;
- catalogue versions, collections and publication;
- approval, rejection, correction, version history and retirement;
- mobile product creation and controlled launch.

Publishes two governed projections:

1. operational product projection for Central/Trace;
2. customer-safe product projection for Customer App.

Forbidden:

- direct customer order processing;
- finance/credit decisions;
- stock reservations or movements;
- production/dispatch state transitions;
- physical barcode scan evidence.

### 3.4 Trace — `oasis-trace`

Owns:

- barcode/QR identity application;
- label rendering, print queue, reprint and verification evidence;
- batch/pack/carton physical identifiers;
- scan capture and duplicate prevention;
- operator/device/time/location attribution;
- cartonisation;
- physical handovers and movement events;
- offline scan queue and safe replay;
- movement exceptions;
- chain-of-custody and forensic timelines;
- device health relevant to physical execution.

Boundary rule:

> Trace records physical evidence; Central posts operational and inventory consequences.

Forbidden:

- approving finance;
- independently changing available stock;
- advancing customer-visible order state without Central validation;
- creating product-commercial truth;
- absorbing Central admin dashboards or AI Studio workspaces.

### 3.5 Supabase Core — `oasis-supabase-core`

Owns:

- canonical shared database migrations;
- RLS policies and grants;
- shared Edge Functions;
- authenticated customer-safe RPC contracts;
- shared identity, event, audit and integration primitives;
- schema compatibility and migration governance;
- shared storage governance;
- environment and deployment contract documentation;
- backend contract tests and drift detection.

Application repositories may retain historical migration/function files temporarily, but no new shared backend authority may be introduced there without an explicit Core-governed exception and migration plan.

Forbidden:

- application pages/components;
- customer, admin, product-studio or handheld user experience;
- duplicating business workflows already owned by an application repository.

## 4. Shared capability ownership

### CRM

- Primary operational owner: Central.
- Customer-safe self-service projection: Customer App.
- Shared CRM entities/contracts: Core.
- Product recommendations may consume AI Studio data.
- Physical complaint evidence may consume Trace data.

CRM is not a sixth repository.

### Catalogue

- Product/editorial authority: AI Studio.
- Shared publication contracts: Core.
- Operational consumption: Central and Trace.
- Buyer presentation: Customer App.

### Labels

- Label content/specification: AI Studio.
- Label requirement/command: Central.
- Rendering, printing, reprinting, verification and physical evidence: Trace.
- Shared schema/contracts: Core.

### Inventory

- Physical movement evidence: Trace.
- Reservation, availability, ledger and consequences: Central.
- Shared entities/event contracts: Core.

### Order status

- Canonical internal state: Central.
- Physical evidence inputs: Trace.
- Customer-safe mapping/contracts: Core.
- Presentation: Customer App.

## 5. Cross-repository integration rules

1. No application screen may directly write another repository's authority tables.
2. Cross-repo writes use governed commands/RPCs/Edge Functions.
3. Cross-repo reads use versioned projections/contracts.
4. Every command/event carries actor, source app, correlation ID, idempotency key and schema version.
5. Consumer failure must not silently create a competing local truth.
6. Raw operational or scan events are not customer-safe by default.
7. Shared schema changes begin in Core or are transferred to Core before production acceptance.
8. A cross-repo change requires compatibility tests for producer and consumers.

## 6. Duplicate-module treatment

When an existing module violates these boundaries:

- mark it `LEGACY`, `PREVIEW`, `PROJECTION`, or `DEPRECATED` immediately;
- disable new writes if it competes with canonical authority;
- compare functionality and migrate superior features;
- add compatibility redirect/projection;
- prove zero dependencies/data loss;
- archive or delete through a separate reviewed change.

Specific frozen decisions:

- AI Studio, not Central, is the product/editorial authoring authority.
- Expo/React Native is the customer mobile implementation; Vite customer app is reference-only.
- Trace is the physical scan/carton authority; synthetic Central scan/carton previews cannot be production truth.
- Core RPCs are the customer data boundary; direct customer-app operational-table access remains prohibited.
- `support_tickets` is canonical; duplicate `tickets` remains frozen until deletion proof.

## 7. CI enforcement target

Each repository must eventually enforce its boundary in CI:

- Customer App: block direct operational-table access, service-role material and internal routes.
- Central: block new AI Studio authoring surfaces, new Trace scan authority and new shared backend ownership.
- AI Studio: block operational order/finance/inventory/dispatch ownership.
- Trace: retain and update existing boundary guardrails.
- Core: block application UI/source trees and frontend dependencies.

Existing guardrails are credited; missing or outdated patterns are updated under later implementation points.

## 8. Dependency exception for Point 4

Point 3 remains blocked on provider-level Resend rotation evidence. Point 4 has no technical or security dependency on that rotation. Therefore Point 4 may close while Point 3 remains blocked; Point 3 must still complete before any soft launch.

## 9. Acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 4a | Define five-repository ownership matrix | COMPLETE |
| 4b | Define detailed owned and forbidden capabilities | COMPLETE |
| 4c | Resolve CRM/catalogue/label/inventory shared ownership | COMPLETE |
| 4d | Freeze cross-repository integration rules | COMPLETE |
| 4e | Freeze duplicate-module retirement policy | COMPLETE |
| 4f | Correct outdated four-repo boundary statements | COMPLETE |
| 4g | Record CI enforcement targets | COMPLETE |
| 4h | Document dependency exception from blocked Point 3 | COMPLETE |

> **POINT 4 — COMPLETE**
