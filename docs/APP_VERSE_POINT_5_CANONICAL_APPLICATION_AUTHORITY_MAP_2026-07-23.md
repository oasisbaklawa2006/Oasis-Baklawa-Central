# App-Verse Point 5 — Canonical Application Authority Map

**Date:** 2026-07-23  
**Status:** FROZEN  
**Applies to:** Customer App, Central, AI Studio, Trace, CRM capability and Supabase Core

## 1. Governing principle

> Independent experiences, shared operational truth.

The applications remain separate by job and user experience, but no business entity may have two competing final authorities.

## 2. Canonical authority map

| Domain | Canonical authority | Consumers / projections |
|---|---|---|
| Buyer-facing experience | Customer App | Reads governed catalogue, pricing, account, order, dispatch, document and support projections |
| Order processing and fulfilment | Central | Publishes customer-safe status and receives Trace evidence |
| Product/editorial truth | AI Studio | Publishes operational product projection to Central and customer-safe projection to Customer App |
| Physical identity and movement evidence | Trace | Embedded in Central, handheld and Smart TV surfaces |
| Customer relationship management | Central CRM capability | Customer App receives only customer-safe relationship information |
| Shared schema, auth, RLS, RPC, event and integration contracts | Supabase Core | Used by all application repositories |

## 3. Customer App authority

### Owns

- customer authentication and approved-buyer access experience;
- customer dashboard;
- catalogue presentation;
- product discovery, save and compare;
- Order Desk, cart and quote/order submission experience;
- customer-visible account, credit, wallet, documents and payment views;
- customer-safe order and dispatch tracking;
- customer support and Selling Support experience;
- company, branch and buyer-team self-service within governed permissions.

### May write only through governed contracts

- trade-account applications;
- quote/order submissions;
- support tickets;
- customer-safe profile, branch or delivery changes;
- payment proof and permitted document uploads.

### Must never own

- product authoring;
- internal pricing/costing;
- production states;
- inventory balances;
- finance release;
- dispatch release;
- raw Trace scan records;
- direct operational-table access.

## 4. Central authority

### Owns

- canonical customer and CRM operations;
- order intake from Customer App, WhatsApp, sales and manual entry;
- order validation and lifecycle;
- commercial, finance and credit decisions;
- stock reservation and inventory consequences;
- production requirements and department queues;
- assembly, ready goods, third-party store and packing command;
- dispatch readiness, loading, finalisation and gate release;
- complaints, exceptions, ownership, escalation and SLA;
- management dashboards, reports and CMD War Room;
- customer-safe operational status projection.

### Consumes

- approved product and packaging truth from AI Studio;
- physical evidence and movement events from Trace;
- shared auth/schema/contracts from Supabase Core.

### Must never own

- full product/editorial authoring;
- catalogue photography generation authority;
- barcode/scan evidence fabrication;
- independent shared-schema ownership outside Core governance;
- a second customer-facing app.

## 5. AI Studio authority

### Owns

- product creation and enrichment;
- product and variant hierarchy;
- category, department and operational product properties;
- pack, inner-pack, carton and pallet definitions;
- dimensions, weights, CBM, shelf life and storage;
- ingredients, allergens, label content and compliance readiness;
- descriptions, selling points, multilingual copy and channel content;
- product photography, image families, media governance and AI enhancement;
- product approval, version history, catalogue readiness and publication.

### Publishes

- operational product projection for Central;
- customer-safe product projection for Customer App;
- label-content projection consumed by Central and Trace.

### Must never own

- customer orders;
- finance release;
- inventory balances;
- production execution;
- physical scan evidence;
- dispatch or gate authority.

## 6. Trace authority

### Owns

- barcode and QR identities;
- label-print execution and reprint evidence;
- product, batch, pack and carton scan records;
- operator, device, time and location attribution;
- physical handovers and movement lineage;
- duplicate, wrong-stage and mismatch detection;
- offline capture and replay evidence;
- forensic scan, carton and batch timelines.

### Supplies evidence to Central

- identity created;
- label printed/reprinted;
- item/carton scanned;
- handover accepted/rejected;
- quantity mismatch;
- movement completed;
- dispatch and gate scan evidence.

### Must never own

- order approval;
- finance approval;
- inventory balance decisions;
- product editorial truth;
- customer-facing order status;
- final dispatch authority.

## 7. CRM authority

CRM is not a sixth repository.

Central owns the full CRM capability:

- companies, branches, contacts and buyer hierarchy;
- account manager and commercial relationship;
- communication history;
- WhatsApp/call/email/notes;
- promises, tasks, follow-ups, opportunities and samples;
- complaints and service history;
- customer health, risk and next action.

Customer App receives only customer-safe CRM projections such as account manager, company details, branches, relationship status, documents and support history.

## 8. Supabase Core authority

### Owns

- canonical shared schema and migrations;
- RLS and grants;
- shared RPC/read contracts;
- Edge Functions with cross-app responsibility;
- authentication primitives and shared role contracts;
- event, audit, idempotency and correlation standards;
- storage and realtime governance;
- schema compatibility and migration CI.

### Must never own

- application UI;
- customer experience;
- product-editor workflows;
- Central operational screens;
- Trace scanner UI.

## 9. Cross-app command and event rule

No app may silently mutate another app's authority through direct client-side table writes.

Preferred flow:

1. caller submits a governed command;
2. canonical authority validates and commits;
3. canonical event is recorded;
4. projections update for consuming applications;
5. retries are idempotent and auditable.

## 10. Conflict-resolution rule

When two applications disagree:

- product/editorial conflict: AI Studio wins;
- order/finance/inventory/production/dispatch conflict: Central wins;
- physical movement-evidence conflict: Trace record is preserved as evidence, while Central decides business consequence;
- auth/schema/RLS/contract conflict: Supabase Core wins;
- customer-visible wording/status conflict: governed customer-safe projection wins, not raw internal state.

No conflict may be resolved by manually overwriting evidence without an auditable correction/reversal event.

## 11. Canonical end-to-end chain

1. AI Studio defines and publishes the product.
2. Customer App presents the product and receives customer demand.
3. Central accepts, validates and fulfils the demand.
4. Trace proves physical identity, movement and handovers.
5. Central converts validated evidence into inventory and operational consequences.
6. Customer App receives simplified customer-safe statuses and documents.
7. Central CRM records the continuing relationship.
8. Supabase Core preserves the shared contracts, permissions and history.

## 12. Point 5 acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 5a | Define authority for every application | COMPLETE |
| 5b | Define CRM placement | COMPLETE |
| 5c | Define allowed writes and prohibited ownership | COMPLETE |
| 5d | Define cross-app handoffs | COMPLETE |
| 5e | Define conflict-resolution order | COMPLETE |
| 5f | Define canonical end-to-end chain | COMPLETE |
| 5g | Record dependency exception for blocked Point 3 | COMPLETE |

## 13. Dependency exception

Point 5 is independent of the unresolved Resend runtime verification in Point 3. Point 3 remains mandatory before SL-1 soft launch and final production acceptance.
