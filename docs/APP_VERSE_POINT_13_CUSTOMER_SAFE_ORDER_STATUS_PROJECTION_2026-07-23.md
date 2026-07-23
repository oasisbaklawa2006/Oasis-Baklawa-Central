# App-Verse Point 13 — Customer-Safe Order Status Projection

**Point:** 13  
**Purpose:** Freeze the canonical customer-safe order status projection across the Customer App and any external customer communication surfaces.  
**Truth classification:** DOCUMENTED only. This document does not claim runtime implementation.

## 1. Governing principle

Central owns the authoritative internal order lifecycle. Customers must never consume raw operational tables, raw production states, raw finance holds, raw Trace events, internal exception codes, employee notes, fraud indicators, security signals, device information or internal audit data.

The customer-facing state is a governed projection derived from authoritative internal state.

> Internal truth may be detailed and operationally complex. Customer truth must be accurate, understandable, non-misleading and safe.

## 2. Canonical customer-visible statuses

The standard customer-facing lifecycle is:

1. `SUBMITTED` — order request received successfully.
2. `UNDER_REVIEW` — commercial, account or fulfilment validation is in progress.
3. `CONFIRMED` — order accepted and committed for fulfilment.
4. `PREPARING` — stock allocation, production, assembly or packing is underway.
5. `PARTIALLY_READY` — part of the confirmed quantity is ready while the balance remains in preparation.
6. `READY_FOR_DISPATCH` — the committed dispatch quantity is packed and approved for dispatch.
7. `DISPATCHED` — goods have physically left the controlled dispatch point.
8. `IN_TRANSIT` — a valid transport movement is active and customer tracking is available where permitted.
9. `PARTIALLY_DELIVERED` — part of the dispatched quantity has been delivered and reconciled.
10. `DELIVERED` — the fulfilment covered by the order or shipment has been delivered.
11. `COMPLETED` — delivery, documents and financial/operational closure conditions are satisfied.
12. `ACTION_REQUIRED` — a customer decision, document, payment, clarification or approval is required.
13. `DELAYED` — a confirmed commitment is delayed beyond the governed communication threshold.
14. `ON_HOLD` — progression is temporarily paused and the hold is safe and appropriate to disclose.
15. `CANCELLED` — the order or remaining unfulfilled quantity has been cancelled.
16. `RETURN_IN_PROGRESS` — an approved return or reverse movement is underway.
17. `REFUND_IN_PROGRESS` — an approved refund is being processed.
18. `CLOSED_WITH_ADJUSTMENT` — the order is closed after return, credit note, refund, shortage settlement or dispute resolution.

Statuses may be extended only through a versioned shared contract owned by Supabase Core.

## 3. Projection rules

### 3.1 Submitted

Display `SUBMITTED` only after the canonical intake service has persisted the request and returned a governed order or request reference. A local UI success state without durable backend acceptance is prohibited.

### 3.2 Under review

Map internal draft review, customer-term validation, price validation, MOQ checks, address checks, account validation and operational feasibility review to `UNDER_REVIEW`.

Do not expose internal employee names, risk flags, approval chains or raw rejection reasons.

### 3.3 Confirmed

Display `CONFIRMED` only after Central has accepted the order and created an authoritative fulfilment commitment. A quote, draft, WhatsApp interpretation or pending approval is not confirmation.

### 3.4 Preparing

Map reservation, shortage resolution, production, assembly, ready-goods transfer, quality clearance, packing and carton preparation to `PREPARING`, unless a more specific customer-safe state applies.

Customers must not see internal department queue names or individual operator performance states.

### 3.5 Ready for dispatch

Display `READY_FOR_DISPATCH` only after the committed dispatch quantity is physically packed, required checks are complete and Central has accepted dispatch readiness. A packing projection or optimistic estimate is insufficient.

### 3.6 Dispatched

Display `DISPATCHED` only after authoritative gate or dispatch finalisation evidence confirms physical departure. Creating a shipping label, invoice, LR, manifest or vehicle assignment alone does not prove dispatch.

### 3.7 In transit

Display `IN_TRANSIT` only when dispatch is confirmed and a valid transport movement remains open. Tracking data must be customer-safe and must not expose internal driver personal data, private phone numbers, device IDs or facility security information.

### 3.8 Delivered

Display `DELIVERED` only after governed proof of delivery or an authorised delivery confirmation has been accepted. Raw scan receipt alone is insufficient unless the scan contract explicitly represents accepted delivery evidence.

### 3.9 Completed

Display `COMPLETED` only when all required delivery, document and closure conditions are satisfied. Financial settlement details shown separately must remain accurate even where operational closure precedes full payment closure.

## 4. Partial and split fulfilment

A customer-visible order must distinguish:

- ordered quantity;
- confirmed quantity;
- cancelled quantity;
- ready quantity;
- dispatched quantity;
- delivered quantity;
- returned quantity;
- pending balance.

A parent order may remain `PREPARING`, `PARTIALLY_READY`, `PARTIALLY_DELIVERED` or `ACTION_REQUIRED` while individual shipments hold more advanced states.

The projection must not falsely mark the entire order dispatched or delivered because one shipment has progressed.

## 5. Action required

`ACTION_REQUIRED` must include a safe, specific next action such as:

- approve revised quantity;
- confirm substitute;
- provide missing delivery details;
- submit payment evidence;
- clear overdue account action;
- approve revised delivery date;
- respond to a support clarification.

It must not reveal internal suspicion, fraud rules, staff discussions or confidential financial assessments.

Every customer action request requires:

- a plain-language explanation;
- deadline where applicable;
- authorised action channel;
- consequence of no response;
- support path.

## 6. Holds

Internal holds include finance, credit, quality, stock, production, compliance, security, data-integrity and management holds.

Customer projection rules:

- disclose only a safe business explanation;
- never expose internal security or fraud classifications;
- never expose another customer's impact;
- never blame an individual employee;
- distinguish `ACTION_REQUIRED` from an internally managed `ON_HOLD`;
- provide the next review or update time where possible.

## 7. Delays and estimates

A delay must be communicated when the confirmed commitment is no longer reasonably achievable according to the governed threshold.

Customer-safe delay content includes:

- affected order or shipment;
- affected quantity;
- previous commitment;
- revised estimate or next-update time;
- customer action, if any;
- support route.

Prohibited:

- invented dates;
- displaying stale estimates as current;
- silently moving promised dates;
- marking an order delayed merely because an internal SLA timer fired without assessing customer impact.

Estimated dates must include provenance and last-calculated time internally. The customer sees only governed current estimates.

## 8. Cancellation

`CANCELLED` must identify whether cancellation applies to:

- the complete order;
- an individual line;
- a quantity balance;
- a shipment;
- a customer-requested cancellation;
- an Oasis-approved cancellation.

Customer-safe cancellation reasons must use controlled categories. Internal notes remain private.

## 9. Returns, refunds and adjustments

Returns, refunds, replacements, credit notes and shortages must not overwrite the original fulfilment history.

The projection must preserve:

- original order and shipment history;
- return authorisation state;
- reverse movement state;
- inspected/accepted return quantity;
- replacement status;
- refund or credit-note status;
- final adjustment outcome.

`CLOSED_WITH_ADJUSTMENT` is used only after the applicable settlement path is complete.

## 10. Finance-safe projection

Customers may see, subject to role and company scope:

- invoice value;
- amount paid;
- balance due;
- approved credit note;
- refund state;
- due date;
- available customer documents;
- customer-actionable payment requirements.

Customers must not see:

- internal credit scoring logic;
- management approval chains;
- bank reconciliation notes;
- fraud rules;
- internal exposure across unrelated companies;
- employee comments;
- service-role data.

## 11. Trace-safe projection

Trace provides physical evidence. The customer projection may expose governed milestones such as packed, dispatched, in transit and delivered.

Do not expose:

- raw scan payloads;
- HMAC/signature material;
- device identity;
- operator identity unless explicitly approved;
- warehouse security locations;
- internal handover failures;
- forensic timelines;
- rejected or suspicious scan details.

A raw scan never directly determines customer status without Central's accepted business consequence.

## 12. Documents

Customer-visible documents may include governed versions of:

- quotation;
- pro forma invoice;
- tax invoice;
- packing list;
- e-way bill where appropriate;
- transport document;
- delivery proof;
- credit note;
- refund acknowledgement;
- support resolution document.

Document presence must not imply lifecycle completion. For example, invoice generation does not by itself prove dispatch.

## 13. Notifications

Notifications are derived from committed customer-safe transitions, not raw internal events.

Required protections:

- deduplicate repeated notifications;
- suppress transient internal reversals;
- record delivery status;
- honour communication preferences and legal requirements;
- avoid leaking sensitive content in lock-screen previews;
- provide a deep link to the governed Customer App state where available.

## 14. Stale and uncertain data

The Customer App must never silently present stale operational information as live.

Where freshness cannot be guaranteed:

- show the last-updated time;
- display a safe temporary availability message;
- avoid false precision;
- provide refresh and support paths;
- retain the last verified status only if clearly marked.

Unknown internal state must not be converted into an optimistic customer status.

## 15. Customer-visible timeline

The customer timeline is a curated projection, not the audit ledger.

It may include:

- request received;
- order confirmed;
- preparation started;
- quantity ready;
- dispatch completed;
- transit update;
- delivery completed;
- return/refund milestones;
- customer action requests.

It must exclude internal retries, employee assignments, failed authorisation attempts, rejected scans, internal comments, risk flags and system debugging events.

## 16. Access scope

Customer status access is restricted by:

- authenticated user;
- approved buyer account;
- customer company;
- branch access;
- permitted order relationship;
- customer role;
- document sensitivity;
- account suspension status.

A customer user must never gain access by guessing a business reference.

## 17. API and contract boundary

The Customer App consumes only governed RPCs/views/contracts owned by Supabase Core, such as the existing `customer_order_status_v1` and related customer-safe order-item contracts.

The Customer App must not directly query internal order, finance, production, inventory, Trace or audit tables.

Every projection contract requires:

- explicit version;
- field-level ownership;
- RLS and authorisation tests;
- null and stale-data semantics;
- backwards compatibility policy;
- customer-language mapping;
- contract monitoring.

## 18. Customer language

Customer-facing labels must be:

- plain-language;
- consistent across mobile, web, WhatsApp, email and support;
- free from internal abbreviations;
- localisable;
- accurate for B2B operations;
- accompanied by relevant quantity and date context.

Examples:

- use “Preparing your order” rather than “Production queue active”;
- use “Waiting for your payment confirmation” rather than “Finance hold code F07”;
- use “Part of your order has been dispatched” rather than “Split SO child 2 posted”.

## 19. Prohibited behaviours

The following are prohibited:

- UI-only customer statuses without authoritative backend state;
- direct exposure of internal enums;
- treating shipping-label creation as dispatch;
- treating invoice generation as dispatch;
- treating one delivered shipment as full-order delivery;
- hiding cancelled or reduced quantities;
- backdating customer milestones;
- silently changing promised dates;
- showing unsupported exact delivery times;
- exposing internal staff, device or security data;
- allowing customer-facing state to write back directly into internal lifecycle fields.

## 20. Acceptance criteria for later implementation

Point 13 is implemented only when later execution work proves:

1. versioned customer-safe contracts exist in Supabase Core;
2. RLS prevents cross-company and cross-branch access;
3. Central state mappings are deterministic and tested;
4. partial/split fulfilment reconciles correctly;
5. raw Trace events cannot bypass Central consequence handling;
6. stale-data behaviour is explicit;
7. notifications use committed projection transitions;
8. customer language is consistent across all channels;
9. negative-security and enumeration tests pass;
10. production UAT covers normal, delayed, partial, cancelled, returned and disputed orders.

## 21. Point completion classification

This point freezes the governance contract only.

- DOCUMENTED: COMPLETE
- CODED: NOT PART OF THIS POINT
- MIGRATED: NOT PART OF THIS POINT
- TESTED: DOCUMENT CONSISTENCY ONLY
- DEPLOYED: NO RUNTIME CHANGE
- RUNTIME VERIFIED: NO

> **POINT 13 — COMPLETE**
