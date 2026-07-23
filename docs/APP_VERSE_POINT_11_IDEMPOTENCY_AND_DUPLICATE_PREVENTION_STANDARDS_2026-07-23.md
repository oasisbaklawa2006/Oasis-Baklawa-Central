# App-Verse Point 11 — Idempotency and Duplicate-Prevention Standards

**Status:** COMPLETE — governance/documentation freeze only  
**Date:** 2026-07-23  
**Runtime implementation:** not claimed

## 1. Purpose

Prevent duplicate business consequences across Customer App, Central, AI Studio, Trace and Supabase Core while preserving retry safety, offline recovery, external-provider replay handling and full auditability.

## 2. Core rule

Every command that can create or change a business consequence must be processed as:

> same business intent + same idempotency scope = one accepted consequence

Repeated delivery may return the original result, but must not create a second order, payment, reservation, production job, label, scan consequence, dispatch action or notification side effect.

## 3. Required identifiers

Every protected write must carry:

- `idempotency_key`
- `command_id`
- `correlation_id`
- `causation_id` where caused by another command/event
- actor or service identity
- source application
- tenant/company scope where applicable
- entity or aggregate type
- operation name
- request fingerprint or canonical payload hash
- first-seen timestamp

Provider-originated writes must also retain the provider's immutable message/event/request ID.

## 4. Idempotency-key construction

Keys must be generated from stable business intent, not volatile transport details.

Recommended canonical form:

`<tenant>:<source>:<operation>:<business-reference>:<intent-version>`

Examples:

- customer order submission: company + buyer + client draft ID
- WhatsApp order conversion: stitched packet ID + approval revision
- payment proof submission: payment intent ID + document hash
- barcode scan: device ID + local scan UUID
- label print: label job ID + print attempt intent
- dispatch release: dispatch ID + release revision

Random request IDs alone are insufficient when clients can regenerate them during retry.

## 5. Scope boundaries

Idempotency uniqueness must be enforced within the smallest safe business scope:

- tenant/company where records are tenant-bound
- aggregate where command semantics are aggregate-bound
- provider account for webhook events
- device for offline scan UUIDs
- global scope only where the external identifier is globally unique

## 6. Canonical persistence model

Supabase Core must ultimately provide a shared idempotency record with at least:

- key and scope
- command ID
- operation
- request fingerprint
- status: `received`, `processing`, `succeeded`, `failed_retryable`, `failed_terminal`, `expired`
- canonical response reference or response body where safe
- resulting entity IDs
- first and latest attempt timestamps
- attempt count
- lock/lease metadata
- error classification
- retention/expiry metadata

A unique constraint must protect the canonical key plus scope.

## 7. Processing contract

1. Validate identity, authority and payload.
2. Attempt atomic claim of the idempotency key.
3. If already succeeded, return the original accepted result.
4. If processing, return a deterministic in-progress response or safely wait within a bounded period.
5. If retryable failure, allow controlled retry under the same key.
6. If terminal failure, return the stored terminal result unless a new business intent/version is created.
7. Commit business mutation and idempotency success atomically wherever possible.
8. Emit events through the same transaction or transactional outbox.

## 8. Payload conflict rule

Reusing the same idempotency key with a different canonical payload is a conflict, not a retry.

Required response:

- reject with deterministic conflict status
- record both fingerprints
- preserve the original result
- raise an integrity/audit event
- never silently overwrite the first intent

## 9. Duplicate-prevention by domain

### Customer App and order intake

- client draft UUID survives offline retry
- repeated taps or network retries return the same order/draft result
- WhatsApp, manual, email and customer-app sources retain source identity
- probable business duplicates across different source IDs are flagged for review, not auto-deleted

### WhatsApp

- provider message ID prevents webhook replay duplication
- fragmented message stitching preserves each source message
- stitched packet revision is versioned
- packet-to-draft and draft-to-order conversion each have separate idempotency keys

### Payments and finance

- provider transaction ID and bank reference remain aliases, not the sole canonical key
- repeated payment webhooks cannot post duplicate ledger effects
- payment-proof hash helps identify repeated uploads
- reversal/refund commands require distinct intent versions

### Inventory and production

- reservation commands cannot reserve the same requirement twice
- queue seeding from an order line is unique by order-line + fulfilment revision + department
- retries cannot duplicate work orders, stock movements or completion postings

### Trace and scans

- every device-generated scan has a durable local UUID
- server deduplicates by device + local scan UUID
- repeated physical scans may remain separate evidence only when intentionally captured as distinct scans
- one scan event cannot create the same Central inventory or status consequence twice

### Labels and printing

- governed label identity is separate from print-attempt identity
- retrying a failed printer transmission does not create a new governed label
- intentional reprint requires a new authorized reprint command and reason

### Dispatch and gate

- loading confirmation, finalisation and gate release are revision-bound commands
- repeated device submissions return the original release result
- reversal or reopen requires a separately authorized command

### Notifications

- notification intent is unique by recipient + template/event + business reference + version
- retries may resend only according to channel policy
- provider delivery callbacks are deduplicated by provider event ID

## 10. Business duplicate detection

Idempotency handles repeated delivery of the same intent. It does not fully solve independently-created but equivalent business records.

A separate duplicate-detection layer must use domain signals such as:

- customer/company
- source reference
- products and quantities
- requested date
- amount and currency
- address
- provider reference
- time window
- attachment hash

Possible duplicates are linked and reviewed. Records are never silently merged or deleted.

## 11. Concurrency controls

Protected writes require one or more of:

- database unique constraints
- atomic insert-on-conflict
- row locks
- advisory locks
- compare-and-swap/version checks
- short processing leases with expiry

UI button disabling is helpful but is never accepted as the duplicate-prevention control.

## 12. Retry and expiry

- retries reuse the same key for the same intent
- exponential backoff with jitter applies to transient failures
- expiry must exceed the longest credible replay/offline window
- financial, order and Trace keys require long-lived retention
- expiry must never permit a duplicate consequence while the underlying business record remains active

## 13. Offline devices

Offline-capable clients must persist:

- local command UUID
- creation time
- device identity
- actor identity snapshot
- payload fingerprint
- retry count
- sync state

Queue deletion is allowed only after a verifiable server acknowledgement tied to the same command/key.

## 14. Observability and audit

Every attempt must record:

- accepted duplicate, rejected conflict or new processing decision
- key and scope
- request fingerprint
- result entity IDs
- retry/error classification
- actor, device and source
- correlation/causation IDs

Metrics must expose duplicate hits, payload conflicts, stale processing claims, repeated failures and suspicious key reuse.

## 15. Prohibited patterns

- generating a fresh key for every retry
- trusting UI state as the sole protection
- check-then-insert without atomic enforcement
- deleting duplicate evidence without reconciliation
- using timestamps alone as keys
- treating business-reference uniqueness as globally safe without scope
- allowing provider retries to post new financial or inventory effects
- reusing a key for an amended intent without versioning

## 16. Implementation ownership

- **Supabase Core:** shared idempotency schema, constraints, RPC/Edge Function contracts and event/outbox integration
- **Central:** order, finance, inventory, production, dispatch and CRM duplicate controls
- **AI Studio:** product/create/publish command protection and duplicate-product review integration
- **Trace:** device scan UUIDs, offline queue safety, print/reprint separation and evidence replay handling
- **Customer App:** durable client draft/command IDs and stable retry behaviour

## 17. Acceptance criteria for later implementation

This governance point does not close runtime delivery. Implementation is accepted only when:

- database constraints and atomic claim logic exist
- same-key/same-payload retries return the original result
- same-key/different-payload conflicts are rejected
- concurrent duplicate submissions produce one consequence
- offline replay tests pass
- provider webhook replay tests pass
- order, payment, reservation, scan, label and dispatch scenarios are covered
- audit and operational metrics are visible

## 18. Dependency exception

Point 11 is a standards freeze and may complete while Point 3 remains blocked. Secret remediation remains mandatory before soft launch.

> **POINT 11 — COMPLETE**
