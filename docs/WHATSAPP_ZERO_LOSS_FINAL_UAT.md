# WhatsApp Zero-Loss Final UAT

## Purpose

Validate the Issue #232 control plane end to end without writing to orders, payments, inventory, dispatch, customer master or product master.

## Entry criteria

- Intake foundation migration applied.
- Reconciliation exception migration applied.
- Escalation and shift reconciliation migration applied.
- Operator cockpit and manager drill-down migration applied.
- Test users exist for operator, alternate operator, supervisor and unauthorized user.

## Mandatory scenarios

| ID | Scenario | Expected result |
|---|---|---|
| UAT-01 | Create a potential order intake without customer attribution | Intake remains visible as a control gap and cannot silently disappear. |
| UAT-02 | Move a valid intake to ACTIVE_PENDING with next action and due time | Intake appears in operator cockpit with deterministic priority. |
| UAT-03 | Let an ACTIVE_PENDING intake cross its due time | Intake becomes overdue and manager totals increment. |
| UAT-04 | Escalate an ACTIVE_PENDING intake to an authorized alternate owner | Ownership lineage, reason, severity and open escalation are visible; audit evidence is appended. |
| UAT-05 | Attempt escalation to an unauthorized target | Function rejects the transfer and preserves the current owner. |
| UAT-06 | Create a second escalation for the same intake | Previous open escalation is resolved or superseded; only one open escalation remains. |
| UAT-07 | Prepare shift reconciliation while unaccounted intakes remain | Readiness is blocked and clean sign-off is unavailable. |
| UAT-08 | Attempt self-certification by a non-supervisor | Sign-off is rejected. |
| UAT-09 | Resolve all control gaps and open escalations, then sign off as supervisor | Canonical equation balances and sign-off evidence is recorded. |
| UAT-10 | Filter cockpit by operator and team | Results remain bounded to authorized rows and ordering remains stable. |
| UAT-11 | Compare cockpit counts with manager drill-down | Active, control-gap, overdue, due-soon and escalation totals reconcile. |
| UAT-12 | Query as unauthorized user | Protected views/functions return no governed data or reject access. |
| UAT-13 | Repeat reconciliation and cockpit reads under concurrent intake updates | No duplicate terminal accounting, no negative counts and no silent terminal state. |
| UAT-14 | Verify downstream tables before and after all scenarios | No writes occur to orders, order_items, payments, invoices, inventory, dispatch, customer master or product master. |

## Stress checks

1. Seed at least 1,000 governed intake rows across multiple teams and operators.
2. Include mixed due states: control gap, breach, overdue, due soon and healthy pending.
3. Include multiple historical escalations while preserving one-open-escalation-per-intake.
4. Run cockpit and manager queries repeatedly while changing due states and resolving escalations.
5. Confirm deterministic ordering for equal-priority rows.
6. Confirm reconciliation totals remain additive and satisfy:

`potential_received = converted + active_pending + explicitly_closed`

## Exit criteria

- All mandatory scenarios pass.
- No unresolved HIGH or MEDIUM review finding remains.
- Required GitHub checks succeed on the exact PR head.
- No protected downstream write is observed.
- UAT evidence records actor, timestamp, scenario ID, result and supporting query or screenshot.
