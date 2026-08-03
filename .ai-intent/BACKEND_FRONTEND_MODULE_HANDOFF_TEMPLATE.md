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

## State machine

For each state provide:

- State name.
- Meaning.
- Entry conditions.
- Exit conditions.
- Responsible actor/department.
- Allowed actions.
- Blocking reasons.

## Authority matrix

For each action specify:

- Who can view.
- Who can create.
- Who can edit.
- Who can approve/reject.
- Who can override.
- Who can reverse/cancel.
- Whether segregation of duties applies.

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

- Events emitted.
- Events consumed.
- Refresh expectation.
- Whether polling is acceptable.

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
- Every status maps to a canonical backend state or documented projection.
- Every approval/override has a backend enforcement path.
- Every queue has deterministic inclusion and exit rules.
- Every sensitive record has server-side access control.
- Empty/loading/error/permission-denied states are defined.
- Mobile/TV behaviour is specified where relevant.
