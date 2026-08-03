# Backend -> Frontend Module Handoff Template

Use this template when a backend module becomes conceptually stable enough to translate into UI/UX.

## Module identity

- Module/domain:
- Owning backend domain:
- Owning application:
- Primary personas:
- Secondary personas:
- Read-only personas:

## Business outcome

What operational outcome must this module achieve?

## Canonical entities

List the entities and identifiers that the frontend may rely on.

For every frontend-visible or frontend-submitted field specify:

- Canonical field name.
- Data type and format.
- Nullability/requiredness.
- Allowed enum/state values where applicable.
- Relationship and linked-record rules.
- Source-of-truth owner/application.
- Visibility classification: internal, role-restricted, sensitive, or customer-visible.
- Mutability: read-only, user-editable, approval-controlled, or system-derived.

## State machine

For each state provide:

- State name and stable identifier.
- Meaning.
- Entry conditions.
- Exit conditions.
- Responsible actor/department.
- Allowed actions.
- Blocking reasons.
- Frontend display label and semantic category.
- Whether the state is actionable and by whom.
- Relative precedence when multiple conditions coexist.
- Customer-facing projection, if any.
- Unknown/unmapped-state fallback. Unknown states must fail safe as diagnostic/unavailable and must not be coerced into a normal or completed state.

## Authority matrix

For each visible or executable action specify:

- Action identifier/backend command.
- Record and field scope.
- Preconditions and validation rules.
- Request contract.
- Success response contract.
- Denial, conflict and retry behavior.
- Idempotency requirement/key where applicable.
- Audit evidence required.
- View authority.
- Create authority.
- Edit authority.
- Approve/reject authority.
- Override authority.
- Reverse/cancel authority.
- Whether segregation of duties applies.

Every frontend mutation or approval control must map to a backend-authorised operation; local visibility or disabled-state logic is never sufficient authorization.

## Exceptions and approvals

Define:

- Exception type.
- Trigger.
- Required reason/evidence.
- Approval authority.
- Escalation rule.
- Customer-visible impact.

## Queue model

Define the operational queues users actually work from:

- Queue name.
- Inclusion rule.
- Sort priority.
- SLA/ageing rule.
- Primary action.
- Exit condition.

## Data shown in list view

Only include fields necessary to identify, prioritise and act.

## Data shown in detail view

Include full operational context, evidence and linked records.

## Realtime/events

For every emitted or consumed event specify:

- Event name and purpose.
- Payload schema/version.
- Canonical entity key/correlation identifiers.
- State/version/sequence field used to prevent regression.
- Ordering guarantee or explicit lack of ordering.
- Duplicate-delivery and idempotent-consumption behavior.
- Reconnect/resubscribe behavior.
- Resynchronization/source-of-truth refresh procedure after missed events.
- Maximum acceptable staleness and stale-data UI behavior.
- Refresh expectation.
- Whether polling is acceptable and, if so, its interval/backoff constraints.

Consumers must never allow delayed, duplicated or out-of-order updates to regress a record to an older authoritative state.

## Audit requirements

- Actor.
- Timestamp.
- Before/after values.
- Reason.
- Approval reference.
- Evidence/attachments.

## Device surfaces

### Desktop

Primary workflow and information density.

### Mobile/handheld

Actions that should be available on phone/scanner-class devices.

### TV

Read-only metrics/queues/alerts, if applicable.

## Customer-facing projection

State which fields/states can be shown externally and which must remain internal.

## Frontend acceptance contract

The frontend should not be considered final until:

- Every visible action maps to a backend-authorised action.
- Every status maps to a canonical backend state and defined frontend projection.
- Every approval/override has a backend enforcement path.
- Every queue has deterministic inclusion and exit rules.
- Every sensitive record has server-side access control.
- Every realtime/event consumer has defined ordering, duplicate, reconnect/resync and stale-state behavior.
- Empty/loading/error/permission-denied/unknown-state states are defined.
- Mobile/TV behaviour is specified where relevant.
