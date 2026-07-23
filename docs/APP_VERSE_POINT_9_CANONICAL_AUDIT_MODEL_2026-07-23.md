# App-Verse Point 9 — Canonical Audit Model

**Date:** 2026-07-23  
**Scope:** Customer App, Central, AI Studio, Trace, Supabase Core, CRM capabilities, integrations and all device surfaces  
**Status:** FROZEN  
**Truth classification:** DOCUMENTED; not yet fully coded, migrated, deployed or runtime verified

## 1. Purpose

The canonical audit model is the permanent evidence standard for the Oasis App-Verse. It must make every material action reconstructable across the five repositories without allowing application screens, administrators or integrations to rewrite physical, financial or operational history.

The model answers:

- who or what acted;
- under which role and scope;
- from which application, device and session;
- on which canonical entity;
- what command was requested;
- what state existed before and after;
- why the action was taken;
- which approvals or step-up checks applied;
- which cross-app workflow caused it;
- whether it succeeded, failed, retried, reversed or was rejected;
- which physical or documentary evidence supports it.

## 2. Governing principles

1. Audit evidence is append-only and immutable after acceptance.
2. Business-state correction creates a new corrective event; it never edits historical evidence.
3. Every material write is attributable to a human or service identity.
4. Service writes preserve the originating human actor and correlation chain where one exists.
5. Application logs are diagnostic aids, not the canonical audit ledger.
6. Raw Trace evidence is preserved even when Central rejects its business consequence.
7. Customer-facing audit history is a governed projection, never unrestricted internal evidence.
8. Secrets, credentials, complete payment data and unnecessary personal data must not be copied into audit payloads.
9. Retry and duplicate suppression remain auditable without producing duplicate business consequences.
10. Emergency overrides require stronger evidence than ordinary actions.
11. Audit capture failure for protected actions must fail closed or enter an explicit governed recovery state.
12. Retention, export and deletion policies must preserve statutory and operational evidence requirements.

## 3. Canonical audit record

Every canonical audit entry requires:

### Identity

- `audit_event_id` — immutable UUID;
- `occurred_at` — authoritative server timestamp;
- `recorded_at` — ledger acceptance timestamp;
- `actor_type` — user, service, device or system;
- `actor_id` — canonical actor identity;
- `effective_role_ids` and evaluated capabilities;
- `delegated_by_actor_id` when acting under delegation;
- `service_identity_id` for automated execution;
- `originating_actor_id` when a service acts for a user.

### Scope and surface

- company, branch, department and location scope where applicable;
- application/repository source;
- surface type — desktop, mobile, handheld, Smart TV, API, Edge Function, worker or scheduled job;
- device ID, session ID and trusted-device status where available;
- environment — production, staging, preview or local;
- source IP or network metadata only where lawful and operationally justified.

### Target and action

- canonical entity type and entity ID;
- stable business reference where useful;
- command name and version;
- action category — create, edit, submit, approve, reject, assign, hold, release, reverse, cancel, print, reprint, scan, handover, publish, suspend, export or administer;
- lifecycle state before and after;
- changed-field list;
- bounded before/after values or protected change digest;
- reason code and human-readable reason for sensitive actions.

### Workflow linkage

- correlation ID;
- causation ID;
- idempotency key or digest where applicable;
- source message/webhook/provider reference;
- related order, customer, product, batch, carton, payment, ticket, dispatch or document IDs;
- parent/child audit links for composite operations.

### Outcome and evidence

- requested, accepted, succeeded, partially succeeded, failed, rejected, reversed or quarantined outcome;
- failure category and safe error code;
- approval and second-approval identities;
- step-up authentication method and verification result, never the secret itself;
- evidence references for files, photos, payment proof, label print, scan, handover, gate or delivery proof;
- retry count and final disposition;
- reversal/correction link where one exists.

## 4. Protected action classes

### Class A — routine operational evidence

Examples:

- draft creation;
- ordinary status transition;
- assigned task start/pause/complete;
- notification read state;
- standard document download.

Requires normal actor, target, action, timestamp and outcome attribution.

### Class B — controlled business change

Examples:

- price or MOQ exception;
- order amendment;
- customer approval change;
- inventory reservation adjustment;
- complaint resolution;
- account permission change.

Requires reason, before/after evidence, evaluated permission and workflow linkage.

### Class C — high-risk or irreversible action

Examples:

- finance release/reversal;
- high-value credit note or refund;
- emergency product publication;
- stock adjustment above tolerance;
- manual dispatch or gate override;
- high-risk label reprint;
- retrospective identity merge/split;
- destructive access administration.

Requires step-up authentication, explicit reason, protected before/after state, second approval where configured, immediate notification and post-action review eligibility.

### Class D — immutable physical/compliance evidence

Examples:

- barcode/QR identity assignment;
- label print/reprint;
- product, batch, pack, carton, location or vehicle scan;
- department handover;
- loading evidence;
- gate exit;
- proof of delivery.

Trace owns the raw evidence. Central records the resulting operational decision without rewriting the Trace record.

## 5. Cross-application responsibility

### Customer App

Must audit:

- authentication and approved-identity resolution;
- access application and correction submission;
- quote/order creation and confirmation;
- company/branch/user administration;
- payment-reference or proof submission;
- support/complaint actions;
- sensitive document access;
- session, device and security changes.

It may show only customer-safe audit projections for the approved company scope.

### Central

Owns canonical business and operational audit for:

- CRM commitments and customer communications;
- canonical order intake and amendments;
- finance decisions;
- inventory consequences;
- production/assembly/packing commands;
- dispatch and gate decisions;
- exceptions, escalations and management overrides.

### AI Studio

Must audit:

- product and variant creation;
- field extraction and AI suggestions;
- accepted/rejected AI changes;
- media capture and enhancement lineage;
- technical, commercial, label and catalogue approvals;
- publication, suspension and retirement;
- emergency publish and mandatory post-review.

AI prompts may be referenced by governed version/digest; secrets and unnecessary copyrighted/source material must not be duplicated into the shared ledger.

### Trace

Owns immutable physical evidence for:

- identity and label execution;
- print and reprint history;
- scans;
- handovers;
- movement, location and quantity evidence;
- device/offline/replay state;
- mismatch and duplicate rejection.

Central consumes this evidence and records business consequences separately.

### Supabase Core

Owns:

- canonical audit schema and access policies;
- append-only enforcement;
- shared correlation/causation conventions;
- retention controls;
- governed audit RPCs/Edge Functions;
- cross-app contract and migration authority;
- audit export and integrity verification primitives.

## 6. Domain-specific minimum evidence

### Identity and access

- login method and result;
- identity link/unlink/merge;
- role/capability grant, denial, delegation, expiry and revocation;
- company/branch/department scope;
- device trust and session revocation;
- step-up result.

### CRM and customer relationship

- communication source and participants;
- note, commitment, follow-up and task changes;
- quote/sample/opportunity actions;
- customer-health manual overrides;
- account-manager changes;
- fragmented-message stitching and corrections.

### Orders

- source channel;
- draft and live-order identity;
- price/MOQ/carton/customer-term validation;
- line-level changes;
- submission, approval, rejection, amendment, cancellation, substitution and split fulfilment;
- customer-visible status projection changes.

### Finance

- payment-proof upload and review;
- reconciliation reference;
- credit/wallet/prepaid calculation inputs and decision;
- hold, release, reversal, refund, credit/debit note and dispute;
- approvers, threshold and segregation-of-duties evidence.

Sensitive bank/payment values must be masked or referenced, not copied wholesale.

### Inventory and manufacturing

- reservation/release/expiry;
- stock consequence and ledger reference;
- queue creation, assignment and priority;
- start/pause/complete;
- quantity, wastage, rejection, shortage and quality hold;
- assembly, ready-goods and packing handovers.

### Labels, scans and movement

- governed object identity;
- template/version and printer/device;
- print/reprint reason and approval;
- scan subject, stage, location, operator and result;
- offline capture and replay outcome;
- wrong-stage, wrong-item and duplicate rejection;
- handover sender/receiver and quantity;
- photo/evidence reference.

### Dispatch and gate

- readiness inputs;
- finance/document/carton/label verification;
- vehicle/transporter and loading evidence;
- partial dispatch;
- finalisation;
- gate verification, block, override and exit;
- customer notification projection.

### Support, returns and complaints

- issue category and linked entities;
- evidence uploads;
- responsible department;
- investigation and communication;
- replacement, refund, credit note or rejection;
- reopen and closure evidence;
- root-cause classification.

## 7. Before/after data rules

1. Store only fields necessary to prove the material change.
2. Prefer structured changed-field records over unrestricted object snapshots.
3. Encrypt or tokenize protected values.
4. Mask phone, email, tax and financial identifiers in ordinary audit views.
5. Do not store passwords, OTPs, access tokens, API keys, full card data or secret headers.
6. Large files and images are stored in governed object storage; the audit ledger stores immutable references and digests.
7. AI-generated media/content keeps source version, model/prompt-policy version and acceptance decision lineage.

## 8. Approvals, delegation and segregation of duties

Every approval records:

- requester;
- approver;
- capability and threshold used;
- scope;
- requested and decided timestamps;
- decision and reason;
- step-up result;
- expiry where applicable.

Temporary delegation records grantor, recipient, capabilities, scope, start/end time, reason and revocation. A user may not silently approve their own protected request when segregation is required.

## 9. Corrections, reversals and deletion

- Canonical audit events are never updated or deleted by application users.
- Incorrect business data is corrected through a new governed command.
- The corrective event links to the original event and explains the reason.
- Reversal does not erase the original action.
- Privacy deletion/anonymisation requests must preserve lawful operational evidence while minimizing or cryptographically severing personal data where legally permitted.
- Break-glass platform maintenance requires dual control and separate immutable evidence.

## 10. Retry, failure and idempotency audit

For retried operations the ledger records:

- one stable idempotency identity;
- each delivery/attempt as bounded technical evidence;
- whether the command was newly applied or replayed;
- same-key/different-payload conflict;
- retry reason and backoff class;
- dead-letter/quarantine disposition;
- final business outcome.

Retries must never create duplicate orders, payments, labels, scans, handovers, dispatch events or notifications.

## 11. Customer-safe audit projection

The Customer App may show:

- who in the customer company placed or approved an order;
- quote/order/document/support milestones;
- payment proof received/reviewed;
- company-user invitations and access changes;
- customer-safe delivery/dispatch history.

It must not show:

- internal employee performance;
- raw finance risk notes;
- internal exception ownership;
- unrestricted scan/device data;
- hidden fraud/security indicators;
- other customers or companies;
- protected internal comments.

## 12. Retention and integrity

Retention classes must be configurable by evidence type and jurisdiction, with finance, tax, compliance, employment, product and physical-movement requirements documented before implementation.

Integrity controls must include:

- append-only database policies;
- restricted writer identities;
- sequence/timestamp consistency checks;
- payload digests for protected evidence;
- storage-object digest/version references;
- backup and restore testing;
- export manifests;
- anomaly detection for missing, delayed or impossible event sequences.

No arbitrary retention period is frozen here without legal and accounting confirmation.

## 13. Audit access and reports

### Operational users

See scoped, plain-language history relevant to their responsibilities.

### Managers and CMD

See cross-domain decisions, exceptions, owners, ageing and intervention history according to role.

### Auditors/compliance

Receive read-only governed search, export, evidence manifests and integrity indicators.

### Customers

Receive only customer-safe projections.

All exports are themselves audited.

## 14. Failure handling

- Protected action without accepted audit evidence must not be presented as complete.
- If the ledger is unavailable, Class C and D actions fail closed unless an explicitly designed offline/emergency protocol exists.
- Handheld offline evidence remains pending and cannot be treated as authoritative until server acceptance.
- Audit backlog, write failures, chronology anomalies and orphaned correlations generate operational alerts.
- Recovery preserves original timestamps, device identity, retry evidence and final acceptance time.

## 15. Implementation requirements for later points

Point 9 freezes the contract; it does not claim full runtime enforcement. Later implementation must provide:

- Core-owned canonical audit tables, RLS and governed write interfaces;
- client prohibition on direct audit mutation;
- transactional outbox/event integration;
- actor/device/session propagation;
- Trace evidence linking;
- immutable storage references;
- cross-repository contract tests;
- retention policy confirmation;
- integrity monitoring and export verification;
- UAT for ordinary, sensitive, offline, retry, reversal and failure scenarios.

## 16. Acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 9a | Freeze audit governing principles | COMPLETE |
| 9b | Freeze canonical record/envelope requirements | COMPLETE |
| 9c | Freeze actor, role, device, session and scope attribution | COMPLETE |
| 9d | Freeze entity, command, correlation, causation and idempotency linkage | COMPLETE |
| 9e | Freeze before/after and protected-data rules | COMPLETE |
| 9f | Freeze approval, delegation, step-up and segregation evidence | COMPLETE |
| 9g | Freeze cross-repository ownership and Trace evidence boundary | COMPLETE |
| 9h | Freeze correction, reversal and immutable-history rules | COMPLETE |
| 9i | Freeze retry, failure and duplicate-attempt evidence | COMPLETE |
| 9j | Freeze customer-safe audit projection | COMPLETE |
| 9k | Freeze retention, integrity, access and export requirements | COMPLETE |
| 9l | Record implementation gaps and runtime acceptance requirements | COMPLETE |

## 17. Completion truth

**DOCUMENTED:** yes  
**CODED:** no  
**MIGRATED:** no  
**TESTED:** documentation consistency review only  
**DEPLOYED:** no runtime change  
**RUNTIME VERIFIED:** no

Point 9 is complete as an architecture/governance freeze only. Runtime implementation and enforcement belong to later shared-platform and repository execution points.

> **POINT 9 — COMPLETE**
