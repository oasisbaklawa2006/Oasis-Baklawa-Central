# WhatsApp B2B Domain Boundary and App Placement

**Status:** Binding architecture decision for the current WhatsApp programme  
**Business domain:** `B2B`  
**Operating application:** `Oasis-Baklawa-Central`  
**Customer-facing channel:** One official Oasis B2B WhatsApp number

## 1. Decision

The current WhatsApp programme is a B2B-only business-intake and order-assurance module.

It shall operate as a first-class module inside `Oasis-Baklawa-Central`.

It shall not operate inside Oasis AI Studio, Oasis Trace, or a future B2C/D2C application.

The governing operating model is:

> One official number, one business domain, one governed communication model.

For the current programme:

> One B2B WhatsApp number -> one B2B intake model -> Oasis-Baklawa-Central.

## 2. Why Central owns the module

Central is the operational authority for:

- B2B customer and company identity;
- employee-submitted customer communication;
- order intake and clarification;
- quotations and Sales Order Drafts;
- customer-specific commercial terms;
- payment advice and account queries;
- complaints and enquiries;
- dispatch communication;
- assignment, SLA, escalation, audit, and reconciliation;
- zero-silent-order-loss controls.

These are operational and commercial responsibilities, not product-master responsibilities.

## 3. AI Studio boundary

AI Studio may supply approved product truth to Central, including:

- product IDs, names, aliases, and SKUs;
- variants and specifications;
- packaging hierarchy;
- carton configuration;
- weights, pieces-per-kilogram, and quantity-conversion facts;
- approved catalogue descriptions and media references.

AI Studio shall not own:

- WhatsApp conversations;
- B2B customer identity;
- customer-specific prices or commercial terms;
- clarification cases;
- Sales Order Drafts or Sales Orders;
- payment/account communication;
- dispatch instructions;
- operator assignment or management escalation.

Central may consume approved AI Studio truth through a governed API, database view, projection, or versioned snapshot. AI Studio is not the runtime home of the WhatsApp workflow.

## 4. B2B confidentiality boundary

The B2B module contains or may derive sensitive commercial information, including:

- wholesale and customer-specific prices;
- distributor or account-specific terms;
- minimum order quantities;
- carton and bulk-packaging logic;
- credit limits and outstanding balances;
- payment status;
- quotations and negotiated rates;
- stock and fulfilment information intended for B2B operations;
- internal approval and exception history.

A consumer, retail customer, unknown contact, or future B2C/D2C identity must never receive this information merely because they reached a WhatsApp endpoint.

Access must be enforced server-side. Frontend menu separation is insufficient.

Before any sensitive B2B response, the system must establish:

1. the inbound channel is the configured B2B channel;
2. the requester is an authorised employee or a verified B2B contact;
3. the relevant B2B company/account is resolved;
4. the requested data is permitted for that contact and workflow;
5. the response is generated from an approved B2B authority.

AI confidence alone is never permission to disclose sensitive information.

## 5. Fixed domain identifier

Every B2B intake, message packet, clarification case, work item, and order-draft lineage should carry a server-controlled domain marker:

`business_domain = B2B`

The value must be derived from the configured ingress/channel and trusted backend configuration.

It must not be accepted from an untrusted client request as an authority decision.

## 6. Ingress responsibility

The B2B WhatsApp ingress layer must remain narrow. It may:

- verify the provider webhook;
- capture the raw message and metadata;
- preserve media references;
- deduplicate by provider message ID;
- retry transient failures;
- hand the communication to the Central B2B intake pipeline.

It must not independently:

- infer entitlement to B2B prices;
- mutate customer ownership;
- create a live Sales Order;
- bypass clarification or approval;
- route the message into a B2C/D2C workflow.

## 7. Future B2C and D2C rule

Future B2C and D2C programmes must use separate customer-facing channels and separate business modules.

Recommended future model:

- one B2B number and B2B workflow;
- one B2C/retail number and B2C workflow;
- one D2C/e-commerce number and D2C workflow, where justified.

They may reuse low-level, non-commercial technical libraries such as:

- webhook signature verification;
- phone normalization;
- provider delivery-status handling;
- media download and storage utilities;
- transcription and document-extraction adapters;
- idempotency and retry primitives;
- generic audit-event envelopes.

They must not share by default:

- customer-specific pricing authority;
- account identity or entitlement assumptions;
- order-state authority;
- credit or outstanding information;
- workflow queues;
- response templates containing business-sensitive information;
- closure, escalation, or approval state.

Shared code is permitted. Shared commercial authority is not.

## 8. Central user experience

The current module should be presented inside Central as:

**B2B WhatsApp Business Intake and Order Assurance**

Primary workspaces should include:

- Inbox;
- Potential Orders;
- Awaiting Clarification;
- Enquiries;
- Complaints;
- Payment Advice;
- Account Queries;
- Dispatch Communications;
- Failed Interpretation;
- Unassigned and Ageing;
- Converted and Explicitly Closed;
- Management Reconciliation.

Only authorised B2B roles should access these surfaces and their underlying data.

## 9. Zero-loss interaction with the B2B boundary

A message arriving on the official B2B channel must never be silently ignored merely because the sender appears to be a consumer or cannot immediately be matched to a B2B account.

Instead, it must be:

- durably captured;
- classified as unresolved or non-B2B candidate;
- kept visible to an authorised operator;
- clarified or explicitly redirected;
- closed only with a recorded disposition.

Confidentiality and zero-loss are simultaneous requirements:

> Do not disclose B2B information to an unverified requester, and do not silently discard the communication.

## 10. Acceptance criteria

The architecture fails if any of the following is possible:

- a B2C/D2C or unknown contact receives B2B prices or account information without verified entitlement;
- the B2B WhatsApp workflow depends on AI Studio as its operational runtime;
- a frontend-supplied domain value can select B2B authority;
- one inbound number ambiguously serves B2B and B2C workflows;
- a message is discarded because it is not immediately recognised as B2B;
- future B2C/D2C modules directly read B2B-sensitive workflow state without explicit governed authorization;
- separate business applications independently create conflicting truth for the same B2B conversation or order.

## 11. Final architecture statement

The approved current architecture is:

> The official Oasis B2B WhatsApp number feeds a B2B-only intake, clarification, routing, and order-assurance module inside Oasis-Baklawa-Central. AI Studio supplies approved product truth only. Future B2C and D2C channels will have separate numbers, domain models, permissions, and workflows, while optionally reusing non-commercial technical primitives.