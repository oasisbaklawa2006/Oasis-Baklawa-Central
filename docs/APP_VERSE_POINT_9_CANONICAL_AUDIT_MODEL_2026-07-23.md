# App-Verse Point 9 — Canonical Audit Model

**Status:** DOCUMENTED / GOVERNANCE FROZEN  
**Implementation status:** NOT YET UNIVERSALLY CODED OR DEPLOYED  
**Programme point:** 9

## 1. Purpose

This document freezes the canonical audit model for the Oasis App-Verse. It defines what must be recorded, where authority sits, how audit evidence is protected, and how user, device, command, event and cross-application activity are reconstructed.

This point is an architecture and governance freeze. It does not claim that every existing module already emits the required audit records. Implementation and enforcement remain scheduled under the shared platform and application execution points.

## 2. Canonical principle

> Every material business action must be attributable, reconstructable, tamper-evident and linked to the authoritative entity, actor, device, command and consequence.

An audit record is evidence. It must not be used as a mutable workflow table or as a substitute for the canonical business entity.

## 3. Canonical audit authority

Supabase Core owns the shared audit schema, immutable write contract, retention controls, RLS, database functions and cross-application audit primitives.

Each application owns the semantic correctness of the events it emits:

- AI Studio: product, media, catalogue, approval and publication actions.
- Central: CRM, order, finance, inventory, production, packing, dispatch and gate decisions.
- Trace: barcode, label, print, scan, carton, handover and physical movement evidence.
- Customer App: customer authentication, governed submissions, support requests and customer-visible acknowledgements.
- Shared services: authentication, notifications, integration retries and system-generated actions.

No application may maintain a competing authoritative audit ledger.

## 4. Canonical audit record

Every material audit record must support the following fields or their governed equivalent:

- `audit_event_id`: immutable UUID.
- `occurred_at`: authoritative server timestamp.
- `recorded_at`: persistence timestamp.
- `event_type`: controlled namespaced event name.
- `action`: human-readable controlled action.
- `outcome`: success, rejected, failed, partial or compensated.
- `severity`: informational, warning, high-risk or critical.
- `actor_type`: user, customer, service, device, integration or system.
- `actor_id`: canonical actor identity where available.
- `impersonator_id`: present when delegated or impersonated access is used.
- `device_id`: registered device identity where applicable.
- `session_id`: authenticated session reference.
- `application`: customer_app, central, ai_studio, trace or shared_service.
- `environment`: development, preview, staging or production.
- `entity_type`: canonical entity type.
- `entity_id`: canonical immutable entity ID.
- `business_reference`: order number, SKU, carton number or other display reference where useful.
- `command_id`: command that initiated the action.
- `correlation_id`: cross-application workflow correlation.
- `causation_id`: immediately preceding command or event.
- `idempotency_key`: where the action is retryable.
- `source_ip`: protected network evidence when lawful and available.
- `user_agent`: protected client evidence where relevant.
- `before_state`: controlled redacted state or state hash.
- `after_state`: controlled redacted state or state hash.
- `changed_fields`: explicit field-level delta where appropriate.
- `reason_code`: controlled reason for approvals, rejections, overrides or reversals.
- `reason_text`: optional explanatory note.
- `approval_chain_id`: linked approval workflow when applicable.
- `provider_reference`: namespaced external provider reference.
- `evidence_refs`: linked documents, scans, images, signatures or reports.
- `metadata`: versioned non-sensitive structured context.
- `schema_version`: audit contract version.
- `integrity_hash`: tamper-evidence value where implemented.

Secrets, passwords, access tokens, complete payment credentials and unrestricted personal data must never be stored in audit payloads.

## 5. Events that must be audited

### Authentication and access

- sign-in, sign-out, failed sign-in and lockout;
- OTP issue, verification and failure without storing the OTP;
- password, MFA or recovery changes;
- role, permission and scope assignment or removal;
- step-up authentication attempts;
- service-role or elevated administrative use;
- denied access to sensitive operations.

### Master and editorial data

- product, variant, pack, carton and catalogue creation;
- material field changes;
- media upload, replacement, enhancement and deletion;
- approval, rejection, correction and publication;
- barcode identity assignment;
- duplicate merge, split or retirement.

### CRM and orders

- customer, company, branch and contact changes;
- WhatsApp packet formation and sender attribution;
- order draft creation, correction and conversion;
- price, MOQ, term or quantity overrides;
- amendments, cancellations, substitutions and split fulfilment;
- priority, ownership, SLA and escalation changes.

### Finance

- payment proof submission and review;
- reconciliation, allocation and reversal;
- credit approval, hold, release and limit changes;
- wallet and ledger adjustments;
- refunds, credit notes, disputes and write-offs;
- second approvals and exceptional overrides.

### Inventory and production

- reservation, release and stock consequence;
- batch creation and status change;
- stock adjustment, wastage, rejection and quality hold;
- work allocation, start, pause and completion;
- assembly, packing and carton composition;
- manual quantity or location correction.

### Trace and dispatch

- label generation, print, reprint and void;
- scan acceptance, duplicate rejection and offline replay;
- carton open, close, split, merge or rebuild;
- handover acceptance or rejection;
- loading, dispatch finalisation and gate verification;
- manual bypass, override or emergency release;
- device registration, health failure and clock anomaly.

### Customer-facing actions

- buyer registration and approval-state changes;
- governed quote or order submission;
- payment-document submission;
- support ticket, complaint and return creation;
- document access where legally or commercially sensitive;
- customer-visible acknowledgement and status publication.

## 6. Immutability and correction

Audit rows are append-only. They must not be edited to conceal an error.

Corrections use a new compensating audit event that references the original event. The original event remains visible and immutable.

Deletion is prohibited except through an explicitly approved legal retention process. Even where payload removal is legally required, a minimal tombstone and deletion-authorisation record must remain where lawful.

## 7. State capture and redaction

Before/after payloads must be limited to the fields necessary to explain the change. Large objects, media files and documents are referenced rather than copied.

Sensitive values must be redacted or represented by hashes. Audit readers must not gain access to data beyond their normal authority merely because it appears in an audit record.

## 8. Trace physical evidence rule

Trace evidence is immutable physical observation. Central may determine the business consequence of a Trace event, but it cannot rewrite or delete the original scan, print, handover or gate evidence.

Where Central rejects a scan consequence, both facts remain:

1. Trace observed the physical action.
2. Central rejected, quarantined or compensated the business consequence.

## 9. Human and device attribution

Operational actions must record both the human actor and registered device when a device is involved.

Shared logins are prohibited for material operational work. Smart TVs are display identities only. Handheld devices must have registered identity, assigned scope and operator session association.

Impersonation or delegated access must record both the effective actor and the initiating administrator.

## 10. Cross-application reconstruction

A workflow crossing applications must share a `correlation_id`.

Each command or event must reference its immediate cause through `causation_id` where applicable. This allows reconstruction such as:

customer submission → Core RPC → Central order draft → finance release → production queue → Trace scan → Central dispatch consequence → customer-safe status publication.

## 11. Failure, retry and idempotency evidence

Every retryable integration must record:

- original command;
- attempt number;
- idempotency key;
- provider response category;
- retry decision;
- terminal outcome;
- compensation or manual intervention.

Duplicate requests must be auditable even where no duplicate business entity is created.

## 12. Approval and segregation-of-duties evidence

High-risk actions must preserve:

- requester;
- approver or approvers;
- timestamps;
- reason;
- scope;
- before/after values;
- step-up authentication evidence;
- conflict-of-interest or self-approval prevention result.

## 13. Customer-safe audit projection

Customers may receive a limited activity history relevant to their own company, orders, payments, documents and support tickets.

They must never receive internal notes, employee identities beyond approved display rules, security events, risk scores, internal approval debates or other companies’ information.

## 14. Retention classes

The implementation must support configurable retention classes:

- security and access evidence;
- financial and statutory evidence;
- operational transaction evidence;
- physical traceability evidence;
- customer communication evidence;
- low-risk diagnostic telemetry.

Exact retention periods require legal, tax, food-traceability and privacy confirmation before implementation. This document does not invent statutory durations.

## 15. Access to audit records

Audit access follows least privilege:

- auditors and authorised management receive governed read access;
- department users see only relevant scoped activity;
- administrators cannot silently alter audit evidence;
- customer users receive only customer-safe projections;
- service identities write through controlled functions and do not receive broad human-readable audit access.

Export of audit records is itself audited.

## 16. Monitoring and alerting

The future shared ledger must support alerts for:

- repeated authentication failure;
- permission escalation;
- unusual service-role use;
- high-value financial override;
- repeated reprints or voids;
- scan replay or device-clock anomaly;
- manual stock adjustment;
- gate bypass;
- abnormal deletion or export attempts;
- audit emission failures.

Failure to write a required high-risk audit event must fail the related high-risk command unless a formally approved resilience exception applies.

## 17. Implementation boundary

This point freezes the model only.

The following are not claimed complete here:

- one production audit table or event ledger across all apps;
- universal triggers or application emitters;
- immutable storage enforcement;
- retention jobs;
- integrity hashing;
- audit dashboards;
- anomaly detection;
- complete historical migration;
- runtime UAT.

These must be implemented and verified under later points, especially Point 20 and the relevant application execution points.

## 18. Point 9 acceptance

Point 9 is complete when this governance model is committed and reviewable. It does not count as implementation of the shared event ledger.

**Classification:** DOCUMENTED  
**Coded:** NO  
**Migrated:** NO  
**Tested:** documentation review only  
**Deployed:** NO application/runtime change  
**Runtime verified:** NO

> **POINT 9 — COMPLETE**
