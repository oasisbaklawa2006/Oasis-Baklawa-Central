# App-Verse Point 10 — Event and Command Standards

**Status classification:** DOCUMENTED governance freeze  
**Runtime implementation status:** not yet implemented as one shared platform contract  
**Canonical contract authority:** `oasis-supabase-core`

## 1. Purpose

This standard defines how Oasis Baklawa applications request work, record completed facts, correlate multi-step workflows, retry safely, and reject duplicate or unauthorised messages.

The five repositories must not invent incompatible command or event formats. Shared envelopes, validation, versioning and persistence contracts belong to Supabase Core. Application repositories may define domain-specific payloads only within these standards.

## 2. Command versus event

### Command

A command is an authenticated request for one authoritative service to perform a specific action.

Examples:

- `order.create`
- `order.approve_draft`
- `payment.release_hold`
- `production_job.start`
- `label.print`
- `carton.close`
- `dispatch.finalise`
- `gate.release`

A command:

- uses imperative naming;
- has exactly one authoritative handler;
- may be accepted, rejected or remain pending;
- must include an idempotency key for state-changing work;
- must not be treated as evidence that the requested result occurred.

### Event

An event is an immutable statement that an authoritative fact already occurred.

Examples:

- `order.created`
- `payment.hold_released`
- `production_job.started`
- `label.printed`
- `carton.closed`
- `dispatch.finalised`
- `gate.released`

An event:

- uses past-tense naming;
- is append-only;
- has one producing authority;
- may have multiple consumers;
- must never be edited to rewrite history;
- may be followed by a correction, reversal or superseding event.

## 3. Canonical envelope

Every shared command or event must carry the following envelope fields.

| Field | Requirement |
|---|---|
| `message_id` | immutable UUID for this message |
| `message_type` | `command` or `event` |
| `name` | namespaced command/event name |
| `schema_version` | positive integer version |
| `occurred_at` | UTC timestamp for event fact or command creation |
| `recorded_at` | UTC timestamp when accepted by shared infrastructure |
| `source_app` | customer_app, central, ai_studio, trace, supabase_core or approved integration |
| `producer` | authoritative service/function identifier |
| `actor_id` | authenticated user or service identity |
| `actor_type` | user, service, device, provider or system |
| `company_id` | tenant/company scope where applicable |
| `branch_id` | branch scope where applicable |
| `device_id` | device identity for mobile, handheld or terminal actions |
| `aggregate_type` | canonical entity/aggregate type |
| `aggregate_id` | canonical UUID of affected aggregate |
| `business_reference` | optional stable human-readable reference |
| `correlation_id` | workflow-wide UUID |
| `causation_id` | message ID that directly caused this message |
| `idempotency_key` | required for state-changing commands |
| `traceparent` | optional distributed tracing value |
| `payload` | versioned domain data |
| `metadata` | bounded non-authoritative context |
| `classification` | public, internal, confidential or restricted |

Secrets, service-role keys, access tokens, passwords and full payment credentials must never appear in payloads or metadata.

## 4. Naming rules

Names use lower-case dot-separated domains.

Format:

`<domain>.<action_or_fact>`

Examples:

- `catalogue.product_published`
- `order.submit`
- `order.submitted`
- `inventory.reservation_failed`
- `trace.scan_recorded`
- `dispatch.loading_completed`

Names must not include screen names, repository names, UI button labels or implementation details.

## 5. Command handling contract

The authoritative handler must perform, in order:

1. envelope/schema validation;
2. authentication validation;
3. permission and scope validation;
4. idempotency lookup;
5. optimistic concurrency or current-state validation;
6. business-rule validation;
7. atomic authoritative state change;
8. audit record creation;
9. event/outbox creation;
10. acknowledgement response.

A successful HTTP response without authoritative persistence is not command success.

## 6. Command acknowledgement

A command response must identify one of these states:

- `accepted` — recorded for asynchronous processing;
- `completed` — authoritative state transition committed;
- `rejected` — validation, permission or business-rule failure;
- `duplicate` — same idempotency key and semantically identical request already handled;
- `conflict` — aggregate version or lifecycle state prevents execution;
- `failed` — infrastructure failure before completion.

Responses must include:

- `command_id`;
- `status`;
- `correlation_id`;
- authoritative aggregate ID/reference when created;
- machine-readable error code when not completed;
- safe human-readable message;
- retry guidance.

## 7. Event production rules

An event is emitted only after the authoritative transaction is committed.

For database-backed workflows, the preferred pattern is transactional outbox:

- authoritative state and outbox record commit together;
- a dispatcher publishes the outbox record;
- publication attempts are tracked;
- duplicate publication remains safe because consumers are idempotent.

No frontend may directly declare a business event solely because a user clicked a button.

## 8. Delivery semantics

The platform assumes **at-least-once delivery**.

Therefore:

- producers may publish the same message more than once;
- consumers must deduplicate by `message_id` and relevant idempotency scope;
- ordering is guaranteed only within an explicitly defined aggregate stream;
- consumers must tolerate delayed and out-of-order delivery;
- exactly-once claims are prohibited unless backed by transactional proof.

## 9. Correlation and causation

`correlation_id` remains constant through one end-to-end business workflow.

Example:

Customer order submission → order validation → finance decision → inventory reservation → production jobs → cartons → dispatch → gate release.

`causation_id` points to the immediate command or event that caused the current message.

This chain must allow reconstruction of:

- original customer/source request;
- employee or system action;
- every automated consequence;
- failures and retries;
- final customer-safe status.

## 10. Versioning

- Every message has `schema_version`.
- Additive optional fields may remain within a compatible version only when existing consumers remain valid.
- Renamed, removed, retyped or semantically changed fields require a new version.
- Consumers must reject unsupported versions explicitly, not silently misread them.
- Producers must support a controlled migration window where required.
- Version adapters belong in Supabase Core or the authoritative integration boundary, not scattered across UIs.

## 11. Retry policy

Retries are permitted only for failures classified as transient.

Typical retryable classes:

- temporary network failure;
- timeout before acknowledged completion;
- provider throttling;
- temporary dependency unavailability;
- database serialization conflict where safe.

Non-retryable classes:

- invalid schema;
- unauthorised or forbidden action;
- violated business rule;
- unsupported version;
- permanently missing entity;
- lifecycle conflict requiring human decision.

Retries must use bounded exponential backoff with jitter, retain the same command/idempotency identity where semantically identical, and record every attempt.

## 12. Dead-letter and quarantine

Messages that exceed retry limits or cannot be interpreted safely enter a governed dead-letter/quarantine state.

The quarantine record must include:

- original immutable envelope;
- failure classification;
- attempt history;
- first and latest failure timestamps;
- responsible integration/domain owner;
- remediation disposition;
- replay authorisation and resulting message ID.

Operators must never edit an original failed event to make it pass. Replay creates a new delivery attempt or corrective command with preserved lineage.

## 13. Security and privacy

- All state-changing commands require authenticated callers or cryptographically verified provider/webhook identity.
- Service-to-service messages use least-privilege credentials.
- Webhooks require signature verification and replay protection.
- Restricted fields must be redacted from logs and customer projections.
- Message access follows company, branch, department and role scope.
- Smart TV and customer clients consume projections; they do not subscribe to unrestricted internal streams.

## 14. Cross-app authority examples

### AI Studio to Central

AI Studio emits `catalogue.product_published` after product approval/publication. Central consumes the approved operational projection; it does not reinterpret draft product truth.

### Customer App to Central

Customer App submits `order.submit` through a governed RPC/command boundary. Central validates and creates the authoritative order, then emits `order.created` or a rejection response.

### Central to Trace

Central issues commands such as `label.print`, `carton.build` or `handover.request`. Trace records physical evidence and emits events such as `label.printed`, `carton.closed` or `handover.scanned`.

### Trace to Central

Trace events do not directly rewrite customer status or inventory balances. Central consumes verified evidence and applies authoritative operational consequences.

### Central/Core to Customer App

Customer App receives governed customer-safe projections derived from authoritative events; raw internal events remain inaccessible.

## 15. Observability

Every shared message must support searchable tracing by:

- message ID;
- correlation ID;
- causation ID;
- aggregate ID;
- business reference;
- actor/device;
- source application;
- command/event name;
- status and failure code.

Operational dashboards must distinguish:

- commands received;
- commands completed;
- commands rejected;
- pending asynchronous work;
- retries;
- dead-letter messages;
- consumer lag;
- projection failures.

## 16. Prohibited patterns

The following are prohibited:

- using local UI state as cross-app authority;
- emitting success events before the transaction commits;
- unversioned shared payloads;
- silent swallowing of command failures;
- retrying business-rule rejections indefinitely;
- deriving idempotency only from timestamps;
- allowing multiple repositories to handle the same authoritative command;
- exposing raw internal event streams to customers;
- deleting failed-message evidence;
- embedding secrets in envelopes or logs.

## 17. Implementation ownership

Supabase Core must eventually provide or govern:

- shared TypeScript/JSON schemas;
- validation utilities;
- command/RPC contracts;
- event ledger/outbox structures;
- idempotency persistence;
- retry/dead-letter structures;
- schema-version registry;
- integration test fixtures.

Central, AI Studio, Trace and Customer App implement only their owned handlers, producers and consumers against those shared contracts.

## 18. Completion classification

Point 10 completes the governance freeze only.

- **DOCUMENTED:** complete
- **CODED:** not complete
- **MIGRATED:** not complete
- **TESTED:** documentation consistency only
- **DEPLOYED:** no runtime change
- **RUNTIME VERIFIED:** not complete

Runtime implementation remains primarily under Points 20, 24 and the relevant domain execution points.

> **POINT 10 — COMPLETE**
