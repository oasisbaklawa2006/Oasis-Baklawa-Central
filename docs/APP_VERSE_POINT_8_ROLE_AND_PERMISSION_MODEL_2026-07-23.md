# App-Verse Point 8 — Canonical Role and Permission Model

**Date:** 2026-07-23  
**Scope:** Customer App, Central, AI Studio, Trace, Supabase Core and all device surfaces  
**Status:** FROZEN

## 1. Governing principles

1. Permissions are capability-based, not screen-name based.
2. Every write requires an authenticated actor and an authorised capability.
3. High-risk actions require step-up authentication and, where defined, second approval.
4. Read access is scoped by company, branch, department, location, role and operational responsibility.
5. Smart TV surfaces are read-only.
6. Handheld roles are narrow, task-driven and location-bound.
7. Customer users can access only customer-safe projections for their own approved company/branch scope.
8. No role can bypass audit, identity, source attribution or event capture.
9. Service roles are backend-only and never exposed to browser or mobile clients.
10. “Super Admin” does not mean unaudited or unrestricted destructive access.

## 2. Permission model

A permission grant is the intersection of:

- **Actor role**
- **Capability**
- **Entity scope**
- **Organisational scope**
- **Location/device scope**
- **Lifecycle state**
- **Approval requirement**
- **Time/session trust**

Canonical permission verbs:

- `view`
- `create`
- `edit`
- `submit`
- `approve`
- `reject`
- `assign`
- `release`
- `hold`
- `reverse`
- `cancel`
- `print`
- `reprint`
- `scan`
- `handover`
- `close`
- `export`
- `administer`

## 3. Executive and governance roles

### CMD / Executive Director

- Full cross-company visibility.
- War Room, exceptions, bottlenecks, customer risk, finance exposure and operational performance.
- May intervene through governed hold, release, reprioritisation and escalation actions.
- Cannot silently alter production evidence, scans, payment evidence or audit history.
- Sensitive actions require step-up authentication.

### Director / Business Owner

- Broad management visibility and governed decision rights.
- Can approve exceptional commercial, finance and operational actions according to configured limits.
- Cannot edit raw Trace evidence or bypass mandatory compliance gates.

### SUPER_ADMIN

- User, role, configuration and emergency platform administration.
- Can configure access but cannot erase immutable audit/evidence.
- Destructive changes require explicit reason, step-up authentication and protected workflow.

### ADMIN

- Broad operational administration without unrestricted security/platform control.
- Cannot assign SUPER_ADMIN, expose secrets, or bypass second-approval rules.

### AUDITOR / COMPLIANCE

- Read-only access to governed operational, financial and trace evidence.
- Can raise findings, request evidence and record observations.
- Cannot execute business state changes.

## 4. Sales and CRM roles

### SALES_HEAD

- Full sales pipeline, Customer 360, quotes, samples, tasks and customer health.
- Can assign accounts, approve commercial exceptions within limits and escalate credit/order issues.
- Cannot release finance holds or alter stock truth.

### SALES_MANAGER

- Team-scoped CRM and order-intake management.
- Can reassign leads/accounts, review drafts, approve routine quotes within limits and monitor SLAs.

### SALES_EXECUTIVE

- Assigned-customer CRM, communication history, quotes, samples, follow-ups and order drafts.
- Can create and submit drafts.
- Cannot self-approve restricted discounts, credit changes or finance release.

### WHATSAPP_OPERATOR

- Inbox, fragmented-message grouping, sender attribution review, packet correction and governed draft creation.
- Cannot convert a draft into a live order without the required review/approval authority.
- Cannot change customer identity evidence without audit and reason.

### CRM_SUPPORT

- Customer records, tasks, commitments, complaints and communication follow-up.
- No finance release, inventory or production write authority.

## 5. Finance roles

### FINANCE_HEAD

- Payment evidence, credit exposure, holds, releases, reversals, ageing, refunds, credit notes and disputes.
- Can approve within configured thresholds.
- High-value or exceptional release requires second approval.

### FINANCE_MANAGER

- Reconciliation, account review, payment-proof validation and recommended release/hold.
- Cannot exceed configured approval threshold.

### FINANCE_EXECUTIVE

- Upload/read evidence, reconcile transactions, prepare adjustments and submit recommendations.
- Cannot independently release restricted orders.

### ACCOUNTS_RECEIVABLE_VIEWER

- Read-only ledger, ageing and payment-status access.

## 6. Operations and production roles

### OPERATIONS_HEAD

- End-to-end order execution, queues, priorities, shortages, blockers, assembly, packing and dispatch readiness.
- Can reprioritise, assign and escalate.
- Cannot override finance release or fabricate Trace completion.

### PRODUCTION_MANAGER

- Cross-department production planning and execution.
- Can allocate batches/work, approve completion exceptions and manage blockers.

### DEPARTMENT_HOD

Separate scoped roles for:

- Arabic Sweets
- Chocolate
- Fusion
- Bakery
- Nuts
- Dragees

Permissions:

- department queue visibility;
- allocate workers/batches;
- start, pause, complete and reject work;
- record shortage, wastage and quality hold;
- initiate governed handover.

Cannot access unrelated departments except read-only dependency visibility.

### PRODUCTION_OPERATOR

- Assigned-job handheld access only.
- Scan, start, pause, record quantity, reject, complete and hand over according to workflow.
- Cannot change targets, approve own exceptions or reopen closed work.

### QUALITY_CONTROLLER

- Inspection, hold, release recommendation, rejection evidence and quality notes.
- Final exceptional release follows configured second-approval rules.

## 7. Stores, assembly and packing roles

### STORE_MANAGER

- Stock receipt, issue, quarantine, location and variance management.
- Can approve routine transfers and recounts.

### STORE_OPERATOR

- Assigned receipt/issue/scan/handover tasks.
- Cannot adjust stock balance directly outside governed transaction.

### ASSEMBLY_MANAGER

- Assembly queue, component readiness, allocation, exceptions and completion approval.

### ASSEMBLY_OPERATOR

- Assigned assembly work, scans, quantities and handovers.

### PACKING_MANAGER

- Packing plan, material readiness, carton rules, label request, repack and completion approval.

### PACKING_OPERATOR

- Pack, scan, verify label, create carton association and complete assigned packing task.

## 8. Dispatch, gate and logistics roles

### DISPATCH_HEAD

- Dispatch readiness, loading plan, transporter/vehicle, documents, partial dispatch and completion.
- Cannot release an order held by finance.

### DISPATCH_OPERATOR

- Assigned loading, carton verification, scan and handover work.
- Cannot mark final dispatch without required evidence.

### GATE_SECURITY

- Verify vehicle, dispatch authority, carton/gate scans and release token.
- Can block exit and raise mismatch.
- Cannot alter order, finance, inventory or dispatch truth.

### LOGISTICS_COORDINATOR

- Transporter, route, vehicle, ETA, delivery follow-up and proof-of-delivery coordination.

## 9. Trace-specific roles

### TRACE_ADMIN

- Trace configuration, device registration, printer mapping and controlled template administration.
- Cannot change Central business state.

### LABEL_CONTROLLER

- Execute approved label requests, manage print queues and review failures.

### REPRINT_APPROVER

- Approves reprints with reason and evidence.
- Cannot approve own reprint request where segregation is required.

### TRACE_INVESTIGATOR

- Full read-only scan, carton, batch, handover and device forensic access.
- Can create investigation findings, not rewrite evidence.

### DEVICE_OPERATOR

- Device-bound scan/handover actions according to assigned task and location.

## 10. AI Studio roles

### CATALOGUE_ADMIN

- Product workflow administration, templates, publication controls and catalogue governance.

### PRODUCT_CREATOR

- Create product drafts, variants, pack data and source facts.

### PRODUCT_EDITOR

- Edit drafts and resolve corrections.

### MEDIA_CREATOR

- Capture/upload media and run governed enhancement workflows.

### TECHNICAL_REVIEWER

- Validate ingredients, allergens, shelf life, storage, weights, dimensions and packaging facts.

### COMMERCIAL_REVIEWER

- Validate MOQ, lead time, channel, market and commercial readiness.

### LABEL_REVIEWER

- Validate label content readiness; does not print labels.

### CATALOGUE_APPROVER

- Approve or reject product versions.

### PUBLISHER

- Publish approved versions to governed projections.
- Emergency publishing requires step-up authentication, reason and mandatory post-review.

### CATALOGUE_CONTRIBUTOR

- Limited draft contribution without approval or publication rights.

## 11. Customer App roles

### CUSTOMER_COMPANY_OWNER

- Company-wide customer-safe access.
- Manage branches, addresses and team invitations within allowed policy.
- Place orders, request quotes and view account documents according to commercial access.

### CUSTOMER_BRANCH_ADMIN

- Branch-scoped ordering, team and address management.

### CUSTOMER_BUYER

- Browse catalogue, view authorised pricing, create drafts, place orders/request quotes and view own company scope.

### CUSTOMER_ACCOUNTS

- Account statement, invoices, payments, credit notes and payment actions.
- Ordering permission is optional and separately granted.

### CUSTOMER_VIEWER

- Read-only catalogue/order/document access within scope.

### CUSTOMER_PENDING

- Registration status and limited public catalogue only.
- No buyer pricing, ordering, credit or documents.

### CUSTOMER_SUSPENDED

- Authentication may remain available for support/notice, but commercial actions are blocked.

## 12. Device-surface rules

### Central Desktop

- Full role-appropriate management and execution surface.

### Central Mobile

- Complete visibility plus fast governed actions.
- Sensitive actions require step-up authentication.

### Operator Handheld

- Narrow task scope, location/device binding and minimal navigation.
- Offline actions remain queued and untrusted until server acceptance.

### Smart TV

- Read-only, role/location-specific, no personal or sensitive finance data unless explicitly approved.

### CMD War Room

- Exception and decision projection, not unrestricted raw-edit access.

## 13. Segregation-of-duties rules

The same actor must not perform both sides of these controls where configured:

- request and approve exceptional finance release;
- request and approve reprint;
- create and approve emergency product publication;
- prepare and approve high-value refund/credit note;
- record and approve inventory adjustment;
- create and approve manual gate-release override;
- raise and close a critical compliance finding without independent review.

## 14. Step-up authentication actions

Mandatory for:

- exceptional finance release or reversal;
- emergency product publish/suspend;
- destructive user/role administration;
- manual stock adjustment above tolerance;
- dispatch/gate override;
- high-risk reprint;
- high-value refund/credit note;
- retrospective identity merge/split;
- audit-protected data correction.

Allowed mechanisms:

- biometric confirmation on trusted mobile device;
- secure PIN;
- OTP;
- second authorised approver.

## 15. Permission inheritance and denial

- Explicit deny overrides inherited grant.
- Company/branch/department/location scope is always enforced.
- Temporary delegation must have start/end time, reason and grantor.
- Suspended or terminated users lose active grants immediately.
- Role name alone must never be trusted without backend-enforced capability evaluation.

## 16. Service and system identities

System identities include:

- Edge Functions;
- scheduled jobs;
- integration workers;
- notification processors;
- event projectors;
- migration/deployment identities.

Rules:

- least privilege;
- dedicated identity per integration where possible;
- no browser exposure;
- all writes attributable to system identity and originating actor/correlation ID;
- rotation and revocation supported;
- service-role credentials never embedded in client code.

## 17. Audit requirements

Every sensitive permission use records:

- actor user ID;
- effective role/capability;
- company/branch/department/location scope;
- device/session identity;
- target entity;
- action;
- old/new state where applicable;
- reason;
- step-up/second-approval evidence;
- timestamp and correlation ID.

## 18. Acceptance record

| Subpoint | Requirement | Status |
|---|---|---|
| 8a | Freeze permission evaluation model | COMPLETE |
| 8b | Freeze executive/governance roles | COMPLETE |
| 8c | Freeze sales/CRM/WhatsApp roles | COMPLETE |
| 8d | Freeze finance roles | COMPLETE |
| 8e | Freeze operations/production roles | COMPLETE |
| 8f | Freeze stores/assembly/packing roles | COMPLETE |
| 8g | Freeze dispatch/gate/logistics roles | COMPLETE |
| 8h | Freeze Trace roles | COMPLETE |
| 8i | Freeze AI Studio roles | COMPLETE |
| 8j | Freeze customer roles | COMPLETE |
| 8k | Freeze device-surface permissions | COMPLETE |
| 8l | Freeze segregation and step-up rules | COMPLETE |
| 8m | Freeze service identity and audit requirements | COMPLETE |

> **POINT 8 — COMPLETE**
