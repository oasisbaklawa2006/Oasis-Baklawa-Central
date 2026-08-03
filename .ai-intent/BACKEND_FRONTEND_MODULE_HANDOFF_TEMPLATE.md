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
- Allowed actions. Each action must reference an Authority matrix action identifier, target state, and permitted transition.
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
- Target state and permitted transition, where the action changes lifecycle state.
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
- Requested value and proposed value, where applicable.
- Approval status and decision outcome.
- Decision actor, timestamp, reason and approval reference.
- Supporting evidence linked to the approval decision.
- Lifecycle states: requested, pending, approved, rejected, expired or superseded.
- Allowed lifecycle transitions for each decision, including the same Authority matrix action identifier, target state and permitted transition used by the corresponding state action.
- Terminal-state rules: expired and superseded exceptions are closed and cannot be approved, edited, or progressed unless a separately authorised reopen action exists.
- Reopen rules: define the stable backend action identifier, authority, preconditions, evidence, audit event, and target state for any permitted reopen path. If no reopen path exists, the frontend must present the exception as terminal and unavailable.

## Queue model

Define the operational queues users actually work from:

- Queue name.
- Inclusion rule.
- Sort priority.
- SLA/ageing rule.
- Primary action.
- Exit condition.
- Current owner or assignee.
- Claim, assignment and reassignment rules.
- Escalation owner.
- Ownership-change audit requirements.

## Data shown in list view

Only include fields necessary to identify, prioritise and act.

## Data shown in detail view

Include full operational context, evidence and linked records.
