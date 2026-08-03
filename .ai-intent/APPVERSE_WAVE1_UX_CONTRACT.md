# App-Verse Wave 1 UX Contract

## Purpose

This document defines the frontend interaction contract for the first operational redesign wave. It is intentionally independent of database/schema implementation and may be prepared before the App-Verse shell PR is merged.

The backend remains authoritative for entities, state machines, permissions, approvals, audit rules and operational truth. This document defines how those truths should be presented once available.

## Canonical design rule

Use the operational simplicity of the later Lumia direction with the visual restraint of the approved Dubai Mall / Souk / Quiet Luxury system.

- Canvas: `#EFEFE9`
- Premium surface: `#F1ECDC`
- Utility surface: `#F8F8F8`
- Primary text: deep espresso
- Primary action: Oasis olive
- Accent: restrained antique gold
- Editorial headings: Libre Caslon Text
- Functional text: Hanken Grotesk

Internal operational surfaces must prioritise speed, clarity and accountability over ornament.

## Universal interaction hierarchy

Every operational screen should present information in this order:

1. What needs attention now.
2. What is blocked and why.
3. What the user can do next.
4. What is progressing normally.
5. History, evidence and diagnostics.

Primary actions should be sequential and limited. Secondary actions belong in contextual menus or detail panels. Destructive, override and exception actions must remain visually distinct and require authority/reason where the backend contract requires it.

## Wave 1 workspaces

### 1. Home

Purpose: a role-specific command surface rather than a generic executive dashboard.

Required regions:

- Role identity and current operational scope.
- Needs Attention queue.
- Today summary.
- Blocked/exception summary.
- Next Actions.
- Relevant app/deep links.
- Optional management intelligence link for authorised leadership.

Home must not invent KPI values when authoritative backend sources are unavailable. Missing data should be represented as unavailable/pending integration rather than synthetic values.

### 2. Orders & Finance

Purpose: present commercial readiness and release decisions as one understandable sequence while preserving Finance as an independent control gate.

Recommended interaction sequence:

`Order received -> Commercial validation -> SO/PI -> Advance/payment -> Finance verification -> Released to Operations`

The UI must separate:

- Customer/order truth.
- Commercial calculations.
- Payment evidence.
- Finance verification.
- Holds and exceptions.
- Approval/override history.

A payment screenshot or UTR is evidence received, not verified payment.

### 3. Operations / Production

Purpose: turn financially released demand into department-owned execution queues.

Recommended structure:

- Ready to release.
- Department queues.
- In progress.
- Blocked/shortage.
- Awaiting handover.
- Completed today.

Orders should decompose into department work, not appear as one undifferentiated task. Department surfaces should emphasize quantity, due time, priority, blockers and next physical action.

### 4. WhatsApp / Support

Purpose: one accountable customer-communication workspace based on the Operator Inbox model.

The UI must preserve:

- Original message/evidence.
- Original human sender.
- Commercial customer/account/branch.
- Forwarding/submitting employee when applicable.
- Stitched conversation context.
- Canonical interpretation.
- Explicit vs inferred vs proposed information.
- Primary intent and responsible department.
- Accountable response owner.
- SLA clocks.
- Customer-facing reply readiness.

No valid business message may disappear merely because resolver/classification failed. Failed, pending, low-confidence and clarification-required records need diagnostic visibility.

## Shared page anatomy

For desktop operational screens:

1. Compact page header.
2. Status/attention strip.
3. Primary queue or work table.
4. Right-side or drawer-based contextual detail where useful.
5. Sequential action footer/panel.
6. Evidence, audit and history behind progressive disclosure.

For mobile/handheld:

1. One task or queue focus at a time.
2. Large touch targets.
3. Maximum five high-level destinations.
4. Bottom navigation where appropriate.
5. Scan/camera/action controls placed within thumb reach.
6. No desktop-style dense sidebar.

For TV:

1. Read-only.
2. Auto-refreshing.
3. Large typography and status colour semantics.
4. Queue, throughput, ageing and blocker emphasis.
5. No edit controls.

## State semantics

Every state-based screen should visibly distinguish:

- Normal progression.
- Waiting on another department.
- Waiting on customer.
- Blocked by control gate.
- Exception requiring approval.
- Overdue/SLA risk.
- Completed.

Colours must never be the sole carrier of meaning; labels/icons are required.

## Approval and exception interaction

Where backend authority requires approval, the frontend must expose:

- Requested change.
- Current value.
- Proposed value.
- Reason.
- Requesting actor.
- Required authority.
- Decision status.
- Audit/history link.

The frontend must not simulate approval by hiding or enabling a button locally.

## Detail-page rule

A user should be able to reach the underlying order/customer/payment/message/scan/audit context in three clicks or fewer from a role Home or primary queue.

## Backend synchronization checkpoints

Detailed screen implementation for a module should not be frozen until the backend thread provides:

1. Canonical entities/fields.
2. State machine.
3. Role/action authority.
4. Approval/exception rules.
5. Required audit evidence.
6. Realtime/event availability where applicable.

If any of these are unresolved, frontend work may continue at component/layout level but should not invent operational behaviour.

## Wave 1 acceptance criteria

Wave 1 is ready for implementation when:

- Home roles and presentation priorities are stable.
- Orders & Finance sequence is agreed.
- Operations/Production queues are mapped to backend states.
- WhatsApp/Support uses one accountable inbox concept.
- Shared page anatomy and visual tokens are accepted.
- No design decision requires changing backend authority.

This contract is presentation guidance only and does not modify schema, RLS, Edge Functions, authentication mode, or production state transitions.
