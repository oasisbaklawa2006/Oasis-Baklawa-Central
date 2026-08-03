# App-Verse Priority Workspace UX Specification

Scope: first implementation wave after shell baseline

This specification is intentionally UI/interaction focused. It does not redefine backend entities, state machines or authority.

## 1. Role Home

### Purpose

Answer four questions immediately:
1. What needs my attention now?
2. What is blocked?
3. What changed since I last looked?
4. What is the next action I am allowed to take?

### Desktop structure

Top strip:
- role/workspace title
- current operating date/time context
- search
- notifications
- user/app switcher

Primary attention zone:
- maximum 3-5 urgent cards
- ordered by business impact and SLA, not by module
- each card shows owner/context, reason, age and one next action

Secondary zone:
- compact metrics relevant to the role
- active queues
- recent completions

Deep-dive zone:
- links to analytical or specialist views such as `/admin/heartbeat`, risk boards or audit screens

### Mobile structure

- no desktop KPI wall
- attention queue first
- one compact summary strip
- maximum five persistent destinations
- large touch targets
- contextual actions at bottom of detail view

### Empty state

Never display an executive dashboard to a role with no eligible command actions. Show the role-specific dedicated-surface message or no-work state.

## 2. Orders & Finance

### Canonical mental model

Order -> commercial readiness -> advance -> execution -> invoice -> balance -> release -> dispatch -> completion.

The UI should make this sequence visible without requiring the user to remember which board owns each step.

### Order list

Default columns:
- SO/order reference
- customer
- order age / promised date
- commercial state
- execution state
- payment state
- blocking reason
- next action

Default filters:
- needs attention
- awaiting advance
- finance hold
- under execution
- awaiting final balance
- ready for release
- overdue
- completed

Avoid exposing every backend field in the table. Additional data goes into column customization or the detail drawer.

### Order detail

Header:
- customer + order reference
- amount / payment summary
- promised date
- current state
- risk/exception badge

Main body:
- sequential lifecycle rail
- current-stage panel
- line-item summary
- department fulfilment summary
- commercial/payment panel
- communication/context panel

Right/detail drawer:
- documents
- audit/evidence
- exceptions
- timeline

### Finance-specific mode

Finance users should see:
- amount due now
- payment evidence
- reconciliation status
- credit/hold reason
- release decision
- invoice/proforma context

The finance action should be explicit: verify, hold, reject/request correction, release. Do not make users hunt across unrelated tabs.

### Specialist screens

`/admin/finance-governance`, finance audit and deep analytics remain specialist screens. They should not become the daily starting point for finance operators.

## 3. Operations / Production / Stores

### Canonical mental model

Demand -> material/readiness -> department work -> QC/assembly/packing -> ready goods -> dispatch handover.

### Operations command center

Management view should show:
- work due today
- overdue work
- blocked work
- department load
- shortages/reservation risks
- orders at risk of missing promised date

Do not show generic charts when an actionable queue can answer the same question.

### Department board

For HOD/production roles:
- Now
- Next
- Blocked
- Completed today

Each work item:
- order/reference
- product/line
- required quantity
- due time/date
- readiness blockers
- next allowed action

Only the department's valid transitions appear as controls.

### Stores

Stores view should prioritize:
- shortages requiring action
- reservations
- material demand from production
- ready-goods availability
- discrepancies requiring reconciliation

Inventory audit/technical stock views remain deeper tools.

### Exception behavior

Every blocked item must answer:
- blocked by what?
- since when?
- who/which department owns the unblock?
- what can this user do now?

## 4. WhatsApp / Support / Customer Attention

### Canonical mental model

One incoming conversation -> resolved customer identity -> intent/work packet -> routed owner -> action/draft -> response -> audit trail.

### Operator inbox

Three-column desktop pattern where space allows:
- left: queue / filters / saved views
- center: conversation
- right: customer + operational context + current work packet

On mobile:
- queue -> conversation -> context drawer
- no permanent three-column compression

### Queue priority

Default queue should emphasize:
- unassigned/unresolved identity
- clarification required
- payment/finance attention
- order intent ready for review
- complaint/escalation
- SLA breach risk

Avoid using sender ownership as message ownership. Original sender identity remains visible.

### Conversation composer

Keep actions sequential:
- respond
- request clarification
- create/update draft work
- escalate

Do not expose automation controls directly inside the ordinary reply composer unless required by the backend contract.

### Context panel

Show only high-value context:
- resolved company/customer
- sender identity and relationship
- open orders
- pending payments/holds
- recent complaints/tickets
- current draft/order packet
- attachments/media evidence

### Support tickets

Tickets should share customer/order context with WhatsApp instead of creating a parallel isolated customer record.

### Manager view

Managers need:
- queue volume
- SLA risk
- unresolved clarification age
- escalation count
- operator workload
- zero-loss/reconciliation exceptions

They do not need the full operator composer as the default screen.

## Reusable interaction primitives to build after #319

- AttentionCard
- QueueList / QueueRow
- StateRail
- SequentialActionBar
- ExceptionBadge + ExceptionDrawer
- ContextDrawer
- EvidenceTimeline
- MetricStrip
- RoleEmptyState
- MobileActionDock
- DesktopDetailDrawer

These primitives should consume data contracts supplied by the backend thread rather than embed business-state logic inside presentation components.
