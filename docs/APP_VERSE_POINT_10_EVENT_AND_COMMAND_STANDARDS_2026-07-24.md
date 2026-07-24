# App-Verse Point 10 — Canonical Event and Command Standards

**Date:** 2026-07-24  
**Scope:** Customer App, Central, AI Studio, Trace, Supabase Core, CRM capabilities, integrations and every device surface  
**Status:** FROZEN  
**Truth classification:** DOCUMENTED; not yet fully coded, migrated, deployed or runtime verified

## 1. Purpose

This standard defines how the Oasis App-Verse requests work, records facts, moves responsibility and communicates across repositories without creating duplicate authority.

It ensures that:

- a command expresses an intention and may be accepted or rejected;
- an event records an immutable fact that has already occurred;
- every cross-app message is attributable, versioned, replay-safe and auditable;
- Central remains the operational authority;
- AI Studio remains the product authority;
- Trace remains the physical-evidence authority;
- Supabase Core governs shared contracts and transport primitives;
- the Customer App receives and emits only governed customer-safe contracts.

## 2. Command versus event

### Command

A command asks an authority to perform or evaluate an action.

Examples:

- `CreateCustomerOrder`
- `ApproveFinanceRelease`
- `ReserveOrderStock`
- `StartDepartmentJob`
- `RequestLabelPrint`
- `AcceptPhysicalHandover`
- `FinalizeDispatch`
- `PublishProductVersion`

A command:

- uses an imperative name;
- has exactly one owning authority;
- can be accepted, rejected, deferred, expired or quarantined;
- must not be treated as completed merely because it was delivered;
- carries actor, scope, reason, correlation and idempotency evidence.

### Event

An event records a fact accepted by the owning authority.

Examples:

- `CustomerOrderCreated`
- `FinanceReleaseApproved`
- `OrderStockReserved`
- `DepartmentJobStarted`
- `LabelPrinted`
- `PhysicalHandoverAccepted`
- `DispatchFinalized`
- `ProductVersionPublished`

An event:

- uses past-tense naming;
- is immutable;
- cannot be rejected after publication;
- may cause new commands or projections;
- never instructs a consumer to perform work merely by implication.

## 3. Prohibited ambiguity

Do not use ambiguous messages such as:

- `OrderUpdate`
- `StatusChanged`
- `ProcessOrder`
- `SyncProduct`
- `ScanDone`
- `PaymentUpdated`

Every command or event must state the business subject and action clearly.

Examples:

- `CustomerOrderLineQuantityAmended`
- `PaymentProofSubmitted`
- `FinanceHoldApplied`
- `CartonBarcodeScanRejected`
- `CustomerSafeOrderStatusProjected`

## 4. Canonical message envelope

Every shared command and event requires this logical envelope:

```text
message_id
message_type
message_name
message_version
occurred_at
recorded_at
producer_application
producer_service
environment
actor
scope
subject
correlation_id
causation_id
idempotency_key
payload
metadata
privacy_class
trace_context
```

### Required fields

- `message_id`: immutable UUID for this message instance;
- `message_type`: `command` or `event`;
- `message_name`: canonical version-independent business name;
- `message_version`: positive integer contract version;
- `occurred_at`: authoritative occurrence/request time;
- `recorded_at`: transport/outbox acceptance time;
- `producer_application`: Customer App, Central, AI Studio, Trace or Core service;
- `producer_service`: bounded service/function/module identity;
- `environment`: production, staging, preview or local;
- `actor`: human, service, system or device attribution;
- `scope`: company, branch, department, location and tenant restrictions;
- `subject`: canonical entity type, ID and stable business reference where useful;
- `correlation_id`: end-to-end business workflow identity;
- `causation_id`: direct message/event that caused this message;
- `idempotency_key`: required for retryable commands and external input;
- `payload`: versioned, validated business data;
- `metadata`: bounded non-authoritative transport context;
- `privacy_class`: public, customer-safe, internal, confidential or restricted;
- `trace_context`: distributed tracing identifiers where available.

## 5. Actor envelope

Actor data includes:

- actor type;
- canonical actor ID;
- effective role/capabilities;
- originating actor for service-mediated actions;
- service identity;
- device and session identity;
- delegation information;
- step-up authentication evidence reference;
- source channel.

Never include passwords, OTP values, tokens, API keys or secret headers.

## 6. Scope envelope

Scope is explicit and never inferred only from the client screen.

It may contain:

- company ID;
- branch ID;
- department ID;
- location ID;
- customer-account ID;
- device assignment;
- permitted entity scope.

The receiving authority re-evaluates permission and scope. Producer claims are evidence, not authorization proof.

## 7. Subject and payload rules

1. Use canonical IDs defined by Point 7.
2. Business references are additional fields, never substitutes for IDs.
3. Payloads contain only data required by the contract.
4. Consumers must not depend on undocumented fields.
5. Dates use ISO 8601 UTC unless a local business date is explicitly required.
6. Money includes currency and uses decimal-safe representation.
7. Quantities include unit of measure.
8. Enumerations are documented and versioned.
9. Files use governed object references and digests, not unrestricted inline blobs.
10. Customer-safe payloads exclude internal notes and protected operational data.

## 8. Message naming convention

### Commands

`VerbBusinessSubject[Qualifier]`

Examples:

- `CreateCustomerOrder`
- `AmendCustomerOrderLine`
- `ApproveCustomerAccess`
- `ReserveInventoryForOrder`
- `CreateDepartmentJob`
- `RequestCartonLabelPrint`
- `ConfirmDispatchLoading`

### Events

`BusinessSubjectPastTenseAction[Qualifier]`

Examples:

- `CustomerOrderCreated`
- `CustomerAccessApproved`
- `InventoryReservedForOrder`
- `DepartmentJobCreated`
- `CartonLabelPrinted`
- `DispatchLoadingConfirmed`

Names remain stable when compatible fields are added. Breaking semantic changes require a new message version or a new name.

## 9. Ownership and write authority

### Customer App

May request governed customer actions, including:

- access application;
- quote or order submission;
- company/branch/user changes;
- payment-reference/proof submission;
- support and complaint creation.

It does not publish internal operational events as authority.

### Central

Owns commands and events for:

- CRM and customer relationship operations;
- canonical order intake and fulfilment;
- commercial validation;
- finance decisions;
- inventory consequences;
- production, assembly and packing orchestration;
- dispatch and gate decisions;
- customer-safe operational status projection.

### AI Studio

Owns commands and events for:

- product/variant creation and enrichment;
- media and photography workflow;
- technical/commercial/label review;
- approval and publication;
- product suspension and retirement.

### Trace

Owns physical-evidence events for:

- barcode/QR identity;
- print and reprint execution;
- scans;
- cartons;
- handovers;
- locations and physical movement;
- device/offline/replay evidence.

Trace accepts Central commands describing expected physical work but does not independently decide finance, inventory balance or canonical order completion.

### Supabase Core

Owns:

- shared message schemas;
- transactional outbox/inbox primitives;
- shared RPC and Edge Function contracts;
- RLS and service identity enforcement;
- contract version registry;
- common delivery, retry and observability standards.

## 10. Acknowledgement and lifecycle

A delivered command may progress through:

- `received`;
- `validated`;
- `accepted`;
- `rejected`;
- `deferred`;
- `expired`;
- `quarantined`;
- `completed`;
- `failed`;
- `reversed` where the business process permits reversal.

Transport receipt is not business acceptance. A producer may display success only after the authority returns the correct acceptance/result contract.

Events progress through transport states only:

- pending publication;
- published;
- delivered;
- delivery retrying;
- dead-lettered/quarantined.

The fact itself remains immutable.

## 11. Transactional outbox and inbox

For database-backed business changes:

1. the authority validates the command;
2. business state and outbox record are written atomically;
3. a worker publishes the event;
4. consumers claim the event through an inbox/idempotency record;
5. projections/actions are applied once;
6. delivery outcome is recorded.

Directly updating state and separately attempting to publish an event without atomic protection is prohibited for critical workflows.

## 12. Delivery guarantee

The App-Verse assumes **at-least-once delivery**.

Therefore:

- all consumers must be idempotent;
- ordering cannot be assumed globally;
- entity/stream sequence checks are required where order matters;
- duplicate delivery is normal and must not duplicate business consequences;
- message loss is detected through outbox/inbox reconciliation;
- exactly-once claims are prohibited unless narrowly proven at a specific boundary.

Point 11 defines the complete duplicate-prevention standard.

## 13. Ordering and concurrency

1. Use per-aggregate version or sequence for order-sensitive streams.
2. Reject or quarantine impossible regressions.
3. Use optimistic concurrency for mutable aggregates.
4. Do not rely only on timestamps to resolve conflicts.
5. Preserve concurrent attempts as audit evidence.
6. Physical Trace evidence may arrive after a Central decision request; Central must wait for required evidence rather than infer completion.

## 14. Versioning

### Compatible evolution

A version may remain compatible when:

- optional fields are added;
- new enum values are introduced only where consumers tolerate unknown values;
- metadata is extended without semantic change.

### Breaking evolution

Increment the major message version when:

- a required field changes;
- a field meaning changes;
- identifier semantics change;
- money, quantity or state meaning changes;
- privacy classification changes materially;
- consumers must change logic.

### Consumer rules

- consumers declare supported versions;
- unknown versions are quarantined, not guessed;
- old versions remain readable during a documented migration window;
- translators/adapters are owned and tested;
- version retirement requires usage evidence and rollback planning.

## 15. Error classification

Errors are classified as:

### Validation

Invalid payload, state, quantity, identifier or unsupported version. Do not retry unchanged.

### Authorization

Actor lacks capability/scope or step-up evidence. Do not retry without corrected authority.

### Conflict

Version conflict, duplicate business intent, state conflict or same idempotency key with different payload. Reconcile before retry.

### Dependency

Required finance, stock, product, document, Trace or external-provider dependency is unavailable/incomplete. Retry or defer according to policy.

### Transient

Timeout, network, rate limit or temporary service failure. Retry with bounded backoff and jitter.

### Permanent external

Provider rejection or invalid external destination. Do not loop; route for correction.

### Unknown

Quarantine with alert and investigation. Never silently discard.

## 16. Retry standard

- retries reuse the same idempotency key for the same business intent;
- retries create bounded technical-attempt evidence;
- exponential backoff with jitter is used for transient failures;
- maximum attempts and maximum age are contract-specific;
- provider rate-limit guidance is respected;
- permanent errors are not retried automatically;
- exhausted messages enter a dead-letter/quarantine queue;
- operators can retry only through a governed action with reason;
- retry does not rewrite the original event.

## 17. Dead-letter and quarantine handling

Every quarantined message records:

- original message and digest;
- failure class;
- first and latest failure time;
- attempt count;
- owning team;
- affected entities/correlation;
- safe diagnostic details;
- required correction;
- replay eligibility;
- resolution and replay evidence.

No business-critical message may disappear into logs without an actionable queue.

## 18. External providers and webhooks

For WhatsApp, MSG91, Resend, payment, logistics and other providers:

- preserve provider message/event ID;
- verify signature/authentication where supported;
- record receipt time and source;
- reject replay and duplicate delivery;
- normalize into a governed command/event only after validation;
- preserve raw payload securely only where necessary and lawful;
- redact secrets and unnecessary personal data;
- separate provider acceptance from business completion;
- reconcile pending provider requests.

## 19. Offline and handheld messaging

Offline devices may create locally unique pending commands.

Requirements:

- registered device identity;
- local command ID and idempotency key;
- original local time plus server acceptance time;
- assigned job/location scope;
- bounded offline validity;
- conflict and stale-state detection;
- explicit pending-sync state;
- replay-safe upload;
- user-visible acceptance/rejection outcome;
- no offline command is authoritative before server acceptance.

## 20. Customer-safe messaging

Customer App contracts may include:

- approved product publication;
- customer price/MOQ projection;
- quote/order acceptance;
- customer-safe status milestone;
- document availability;
- payment/account action;
- support update.

They must exclude:

- raw department queues;
- internal finance/credit notes;
- employee performance;
- unrestricted Trace scans;
- internal exception ownership;
- security and fraud indicators;
- other customer data.

## 21. Security and privacy

- authenticate every producer and consumer;
- authorize every command at the owning authority;
- enforce least-privilege service identities;
- encrypt transport and protected storage;
- never expose service-role or secret keys to clients;
- classify payload privacy;
- minimize personal and financial data;
- use governed object references for documents;
- record security-sensitive use in the Point 9 audit model;
- rotate/revoke provider credentials independently of message contracts.

## 22. Observability

Required metrics:

- commands received, accepted, rejected and failed;
- events pending, published and delivered;
- outbox and inbox lag;
- retry rate and age;
- dead-letter/quarantine count;
- duplicate suppression count;
- version mismatch count;
- orphaned correlation/causation chains;
- consumer lag;
- customer-facing projection delay;
- provider acceptance/failure rate.

Every critical correlation ID must be searchable across the owning applications.

## 23. Canonical cross-app examples

### Product publication

1. AI Studio accepts `PublishProductVersion`.
2. AI Studio records `ProductVersionPublished`.
3. Core publishes governed operational and customer-safe projections.
4. Central updates operational product usage.
5. Customer App receives the customer-safe catalogue projection.

### Customer order

1. Customer App submits `CreateCustomerOrder` with stable idempotency key.
2. Central validates identity, prices, MOQ, terms and duplicates.
3. Central records `CustomerOrderCreated` or returns a governed rejection.
4. Downstream finance/reservation commands share the correlation ID.
5. Customer App receives the accepted order reference and safe status.

### Physical execution

1. Central sends `CreateExpectedPhysicalHandover` to Trace.
2. Trace accepts scans and records `PhysicalHandoverAccepted` or `PhysicalHandoverRejected`.
3. Central evaluates the evidence and advances or blocks operational state.
4. Customer status changes only after Central publishes a safe projection.

### Dispatch

1. Central requests `FinalizeDispatch` after finance, packing, document and Trace prerequisites.
2. Trace supplies loading and gate evidence.
3. Central records `DispatchFinalized` only when all authoritative conditions pass.
4. Customer App receives `CustomerSafeOrderStatusProjected` with `DISPATCHED`.

## 24. Prohibited patterns

- direct cross-repository table writes from clients;
- treating UI state as authority;
- using events as disguised commands;
- publishing an event before its business transaction commits;
- unversioned payloads;
- unauthenticated internal webhooks;
- relying on delivery once only;
- silent message drops;
- infinite retries;
- sharing service-role credentials;
- allowing Customer App to consume raw internal events;
- allowing Central to fabricate Trace physical evidence;
- allowing Trace to independently alter finance or inventory authority;
- using timestamps alone as conflict resolution;
- mutable event history.

## 25. Implementation requirements for later points

Point 10 freezes the standard; later implementation must provide:

- Core-owned message schema registry;
- transactional outbox/inbox tables and governed functions;
- per-authority command handlers;
- contract validation and generated/shared types;
- idempotency enforcement;
- retry/dead-letter workers;
- distributed tracing and correlation search;
- replay tooling with permissions and audit;
- provider adapters;
- contract tests across repositories;
- monitoring and reconciliation dashboards;
- staging and failure-mode UAT.

## 26. Acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 10a | Freeze command versus event semantics | COMPLETE |
| 10b | Freeze canonical message envelope | COMPLETE |
| 10c | Freeze naming and payload rules | COMPLETE |
| 10d | Freeze ownership and write authority | COMPLETE |
| 10e | Freeze acknowledgement and lifecycle states | COMPLETE |
| 10f | Freeze transactional outbox/inbox expectation | COMPLETE |
| 10g | Freeze at-least-once delivery and ordering rules | COMPLETE |
| 10h | Freeze versioning and compatibility rules | COMPLETE |
| 10i | Freeze error and retry classification | COMPLETE |
| 10j | Freeze dead-letter/quarantine handling | COMPLETE |
| 10k | Freeze provider, webhook and offline-device rules | COMPLETE |
| 10l | Freeze security, privacy and customer-safe messaging | COMPLETE |
| 10m | Freeze observability and reconciliation requirements | COMPLETE |
| 10n | Record prohibited patterns and implementation gaps | COMPLETE |

## 27. Completion truth

**DOCUMENTED:** yes  
**CODED:** no  
**MIGRATED:** no  
**TESTED:** documentation consistency review only  
**DEPLOYED:** no runtime change  
**RUNTIME VERIFIED:** no

Point 10 is complete as an architecture/governance freeze only. Runtime enforcement belongs to later shared-platform and repository execution points.

> **POINT 10 — COMPLETE**
