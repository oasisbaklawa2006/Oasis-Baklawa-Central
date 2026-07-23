# App-Verse Point 6 — Canonical Entity Register

**Date:** 2026-07-23  
**Status:** FROZEN  
**Scope:** Customer App, Central, AI Studio, Trace, Supabase Core

## 1. Purpose

This register defines the canonical business entities used across the App-Verse, their authoritative owner, write authority, lifecycle responsibility, required identifiers, and permitted projections. It prevents duplicate tables, duplicate writers, ambiguous ownership and inconsistent cross-app terminology.

## 2. Global entity rules

Every canonical entity must have:

- one stable canonical ID;
- one authoritative lifecycle owner;
- explicit create/update/retire permissions;
- source-system and legacy-reference fields where needed;
- created/updated timestamps;
- actor and audit attribution;
- soft-delete or retirement semantics where appropriate;
- versioning for material business changes;
- event correlation IDs for cross-app workflows;
- customer-safe and internal projections separated where necessary.

No repository may create a second authoritative entity merely because it needs a local screen. Read models, caches and projections must remain traceable to the canonical record.

## 3. Identity and organisation entities

| Entity | Canonical owner | Primary purpose | Other apps may |
|---|---|---|---|
| User | Supabase Core | Authenticated human identity | Read permitted profile/role projection |
| Profile | Supabase Core | User business profile and app eligibility | Read/update governed self or admin fields |
| Role | Supabase Core | Named authority bundle | Read for access decisions |
| Permission | Supabase Core | Atomic action authority | Read/evaluate only |
| Company | Central | Legal/commercial customer or internal company identity | Customer App reads own company; Core governs schema |
| Branch | Central | Customer/internal operating location | Customer App reads own branches; Trace references location |
| Contact | Central CRM | Named customer/vendor/staff contact | Customer App reads customer-safe contacts |
| Address | Central | Billing, shipping, branch, warehouse or facility address | Read/use according to scope |
| Department | Central | Operational business unit | AI Studio assigns product department; Trace references execution department |
| Location | Central | Physical stock/work location | Trace records movements against it |
| Device | Supabase Core / Trace | Registered browser, handheld, scanner or TV identity | Central reads operational device health |

## 4. Customer and CRM entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Customer Account | Central CRM | Commercial relationship master linked to Company |
| Buyer Account | Central CRM | Approved purchasing identity and commercial eligibility |
| Customer Branch Membership | Central CRM | Which buyer can act for which branch |
| Account Manager Assignment | Central CRM | Named internal relationship owner |
| Customer Segment | Central CRM | Business classification, channel and commercial grouping |
| Pricing Tier | Central | Commercial classification used by governed pricing contracts |
| Payment Term | Central Finance | Prepaid, credit, advance, COD or other governed term |
| Credit Facility | Central Finance | Approved limit, validity, exposure and controls |
| Communication | Central CRM | Call, WhatsApp, email, meeting, note or message packet |
| Communication Participant | Central CRM | Original sender, employee sender, customer, contact and channel identity |
| Conversation Thread | Central CRM | Grouped communications across fragmented messages |
| Promise / Commitment | Central CRM | Dated business commitment extracted or entered manually |
| CRM Task | Central CRM | Follow-up/action with owner, due date and status |
| Opportunity | Central CRM | Potential sale, project, sample or relationship opportunity |
| Sample Request | Central CRM | Product sample workflow and outcome |
| Customer Health Assessment | Central CRM | Risk, health, relationship and next-action projection |

## 5. Product and catalogue entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Product | AI Studio | Commercial and editorial product master |
| Product Variant | AI Studio | Flavour, recipe, size, format or differentiated sellable form |
| SKU | AI Studio | Stable sellable/operational stock identity |
| Product Category | AI Studio | Catalogue taxonomy |
| Product Purpose Tag | AI Studio | Retail Star, Café Choice, Export Choice, etc. |
| Product Attribute | AI Studio | Governed structured property |
| Ingredient | AI Studio | Product ingredient truth |
| Allergen | AI Studio | Governed allergen declaration |
| Storage Requirement | AI Studio | Ambient, chilled, frozen or special handling |
| Shelf-Life Rule | AI Studio | Duration and condition-specific product rule |
| Pack Configuration | AI Studio | Unit/inner/outer pack hierarchy |
| Carton Specification | AI Studio | Planned carton quantity, dimensions and weight |
| Pallet Specification | AI Studio | Planned palletisation data |
| Product Composition / BOM | AI Studio | Product or hamper composition authority |
| Packaging Specification | AI Studio | Packaging materials and structural readiness |
| Label Content Version | AI Studio | Approved label wording/data source |
| Product Media Asset | AI Studio | Hero, macro, packaging, open-pack, lifestyle and bulk media |
| Media Generation Record | AI Studio | AI prompt, source, output and review audit |
| Catalogue Version | AI Studio | Approved collection/publication bundle |
| Product Publication | AI Studio | Approved release to operational and customer-safe projections |
| Product Operational Projection | Supabase Core contract | Central-readable approved product subset |
| Product Customer Projection | Supabase Core contract | Customer-safe published product subset |

Central may hold operational overrides only where explicitly governed, such as temporary availability, lead time or production routing. These do not replace AI Studio product truth.

## 6. Commercial and order entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Price List | Central | Customer/channel/currency commercial price authority |
| Product Price | Central | Effective dated sell price, tax and conditions |
| MOQ Rule | Central | Minimum order and increment authority |
| Quote | Central | Commercial proposal before order confirmation |
| Quote Line | Central | Product-level quote detail |
| Order Draft | Central | Pre-submission or staged order intent |
| Order Intake Packet | Central | Canonical intake envelope from app, WhatsApp, sales or manual source |
| Sales Order | Central | Canonical accepted customer order |
| Order Line | Central | Product, quantity, price, tax and fulfilment detail |
| Order Amendment | Central | Governed change after submission |
| Order Cancellation | Central | Governed cancellation record and reason |
| Order Substitution | Central | Approved replacement product/line decision |
| Order Split | Central | Partial or multi-dispatch fulfilment structure |
| Order Status Event | Central | Canonical internal lifecycle event |
| Customer Order Projection | Supabase Core contract | Simplified customer-safe order status and lines |
| Order Document | Central | Proforma, invoice, packing list, statement or related order file |

## 7. Finance entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Payment Request | Central Finance | Amount requested and order/customer context |
| Payment Proof | Central Finance | Uploaded transaction evidence |
| Payment Transaction | Central Finance | Received/recorded payment event |
| Bank Reconciliation Record | Central Finance | Match between bank evidence and internal obligation |
| Wallet Account | Central Finance | Customer prepaid balance |
| Wallet Transaction | Central Finance | Credit/debit/adjustment movement |
| Credit Exposure | Central Finance | Current approved/used/available credit projection |
| Finance Hold | Central Finance | Formal block with reason and authority |
| Finance Release | Central Finance | Canonical clearance event |
| Credit Note | Central Finance | Approved reduction/adjustment document |
| Debit Note | Central Finance | Approved additional charge document |
| Refund | Central Finance | Governed repayment workflow |
| Financial Dispute | Central Finance | Customer or internal disputed amount record |
| Customer Statement | Central Finance | Periodic account statement projection |

## 8. Inventory and planning entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Inventory Item | Central | SKU-level stock authority |
| Inventory Location Balance | Central | Quantity by location and stock state |
| Stock Ledger Entry | Central | Immutable inventory consequence record |
| Reservation | Central | Order-linked stock commitment |
| Reservation Line | Central | SKU/batch/location detail |
| Stock Transfer | Central | Authorised transfer intent and consequence |
| Stock Adjustment | Central | Governed correction with reason and approval |
| Batch | Trace identity + Central operational status | Trace owns immutable physical identity; Central owns operational/commercial consequence |
| Batch Availability Projection | Central | Available/reserved/quarantine/damaged/expired state |
| Replenishment Requirement | Central | Demand-driven production or purchase requirement |
| Inventory Exception | Central | Shortage, mismatch, ageing, expiry or variance issue |

## 9. Manufacturing and execution entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Production Requirement | Central | Quantity needed from order/inventory demand |
| Department Work Queue | Central | Prioritised operational queue |
| Work Item / Command Order | Central | Executable department task |
| Production Batch Assignment | Central | Links work requirement to batch identity |
| Operator Assignment | Central | Worker/team responsibility |
| Work Session | Central | Start, pause, resume and complete record |
| Quantity Declaration | Central | Expected, actual, rejected and wastage quantities |
| Quality Hold | Central | Formal blocked state pending resolution |
| Production Exception | Central | Shortage, blocker, delay or process issue |
| Department Handover Requirement | Central | Expected transfer between stages |
| Assembly Requirement | Central | Component and finished-goods assembly demand |
| Packing Requirement | Central | Required packing configuration and quantities |
| Packing Session | Central | Packing execution record |
| Cartonisation Requirement | Central | Expected carton structure for an order |
| Smart TV Projection | Central | Read-only operational queue and metrics projection |

## 10. Traceability and movement entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Barcode Identity | Trace | Unique machine-readable identity |
| QR Identity | Trace | Governed QR identity where used |
| Label Print Job | Trace | Requested print execution |
| Label Print | Trace | Actual print result |
| Label Reprint | Trace | Reprint event with reason and approval |
| Pack Identity | Trace | Physical pack/tray identity |
| Carton Identity | Trace | Physical carton identity |
| Pallet Identity | Trace | Physical pallet identity where used |
| Scan Event | Trace | Immutable scan evidence |
| Scan Session | Trace | Grouped operational scan activity |
| Handover | Trace | Physical transfer evidence |
| Handover Acceptance | Trace | Receiving-side confirmation or rejection |
| Movement Event | Trace | Physical movement from source to destination |
| Movement Exception | Trace | Wrong item, duplicate, mismatch, missing or invalid movement |
| Device Sync Record | Trace | Online/offline replay and sync status |
| Trace Timeline Projection | Supabase Core contract | Central-readable physical history |

Trace records evidence. Central determines whether evidence advances inventory, order, production, dispatch or finance state.

## 11. Dispatch and gate entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Dispatch | Central | Canonical shipment/dispatch authority |
| Dispatch Line | Central | Order/carton/product fulfilment detail |
| Dispatch Readiness Assessment | Central | Finance, stock, packing, label and document readiness |
| Loading Plan | Central | Vehicle/carton loading intent |
| Loading Evidence | Trace | Physical scan proof of loading |
| Transporter | Central | Logistics provider identity |
| Vehicle | Central | Vehicle master/assignment |
| Driver | Central | Driver identity and contact |
| Route / Delivery Run | Central | Delivery planning record |
| Gate Entry | Central | Vehicle/person entry control |
| Gate Verification | Trace evidence + Central decision | Scan proof plus authority decision |
| Gate Release | Central | Final authorised exit event |
| Proof of Dispatch | Central | Consolidated business confirmation using Trace evidence |
| Proof of Delivery | Central | Delivery evidence and outcome |
| Failed Delivery | Central | Failure, reason, reschedule and consequence |

## 12. Support, complaint and returns entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Support Ticket | Central | Canonical support workflow (`support_tickets`) |
| Ticket Message | Central | Customer/internal communication thread |
| Complaint | Central | Order/item/quality/service complaint |
| Complaint Item | Central | Product/quantity-specific issue |
| Complaint Evidence | Central | Photo, document or media evidence |
| Return Request | Central | Requested reverse-logistics workflow |
| Return Authorisation | Central | Approved/rejected return decision |
| Replacement | Central | Replacement fulfilment record |
| Resolution | Central | Refund, credit note, replacement, rejection or closure |
| Root Cause | Central | Operational cause classification |
| Corrective Action | Central | Assigned remedial action |

The duplicate historical `tickets` table is not canonical and remains frozen until dependency-free retirement.

## 13. Shared platform and governance entities

| Entity | Canonical owner | Notes |
|---|---|---|
| Audit Event | Supabase Core | Immutable cross-app audit record |
| Domain Event | Supabase Core contract | Versioned business event envelope |
| Command | Supabase Core contract | Versioned request to authoritative owner |
| Notification | Supabase Core | In-app/email/WhatsApp/push notification record |
| Notification Preference | Supabase Core | User/channel preferences |
| Document Asset | Supabase Core | Shared governed file metadata |
| File Version | Supabase Core | Version history for governed files |
| Integration Delivery | Supabase Core | Outbound/inbound integration attempt |
| Retry Record | Supabase Core | Failed delivery and replay state |
| Idempotency Record | Supabase Core | Duplicate-prevention state |
| Correlation Record | Supabase Core | Cross-app workflow linking |
| Feature Configuration | Supabase Core | Governed runtime capability/configuration |
| Environment Registration | Supabase Core | Project/environment identity and authority |

## 14. Required key relationships

- Company has many Branches and Contacts.
- Customer Account belongs to Company.
- Buyer Account belongs to Customer Account and may access selected Branches.
- Product has many Variants, SKUs, Media Assets and Publication Versions.
- Sales Order belongs to Customer Account and Branch and has Order Lines.
- Order Line references one SKU and applicable commercial terms.
- Reservation links Order Line to Inventory Item, Batch and Location.
- Production Requirement is derived from demand and feeds Department Work Queue.
- Work Item may create or consume Batch identities.
- Pack and Carton identities contain or reference Batch/SKU quantities.
- Dispatch contains Dispatch Lines and Carton identities.
- Scan Events and Handovers reference physical identities, locations, operators and devices.
- Support Ticket may reference Customer, Order, Order Line, Product, Dispatch, Payment or Complaint.
- Every material state transition writes an Audit Event and Domain Event.

## 15. Entity naming rules

Canonical names are singular in architecture and plural in table collections where appropriate. New aliases are forbidden unless documented as compatibility aliases.

Examples:

- canonical: `support_ticket`; compatibility/deprecated: `ticket`;
- canonical: `sales_order`; customer UI may display “Order”;
- canonical: `customer_account`; UI may display “My Business”;
- canonical: `department_work_item`; UI may display “Command Order” or “Job”;
- canonical: `scan_event`; UI may display “Scan”;
- canonical: `product_publication`; UI may display “Published”.

## 16. Duplicate prevention and retirement

Before introducing a new entity or table, the implementing repository must prove:

1. no canonical entity already covers the purpose;
2. the new concept is not merely a screen-specific projection;
3. ownership is consistent with Points 4 and 5;
4. identifiers and lifecycle are defined;
5. migration and compatibility treatment are documented;
6. duplicate legacy entities have a retirement plan.

## 17. Point 6 acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 6a | Define global entity rules | COMPLETE |
| 6b | Register identity and organisation entities | COMPLETE |
| 6c | Register CRM entities | COMPLETE |
| 6d | Register product/catalogue entities | COMPLETE |
| 6e | Register commercial/order entities | COMPLETE |
| 6f | Register finance entities | COMPLETE |
| 6g | Register inventory/manufacturing entities | COMPLETE |
| 6h | Register Trace/movement entities | COMPLETE |
| 6i | Register dispatch/gate entities | COMPLETE |
| 6j | Register support/return entities | COMPLETE |
| 6k | Register shared platform/governance entities | COMPLETE |
| 6l | Freeze key relationships and naming rules | COMPLETE |

> **POINT 6 — COMPLETE**
