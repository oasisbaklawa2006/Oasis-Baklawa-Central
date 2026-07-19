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
| UAT-05 | Attempt escalation to an unauthorized target | Function raises `target owner is not authorized`; current owner and open-escalation state remain unchanged. |
| UAT-06 | Create a second escalation for the same intake | Previous open escalation is resolved or superseded; only one open escalation remains. |
| UAT-07 | Prepare shift reconciliation while unaccounted intakes remain | Readiness is false and `SIGNED_OFF` raises `shift is not clean for sign-off`. |
| UAT-08 | Attempt self-certification by the preparer | Sign-off raises `preparer cannot self-certify shift reconciliation`; reconciliation remains `PENDING`. |
| UAT-09 | Resolve all control gaps and open escalations, then sign off as supervisor | Canonical equation balances and sign-off evidence is recorded. |
| UAT-10 | Filter cockpit by operator and team | Results remain bounded to authorized rows and ordering remains stable by `priority_rank`, `sla_due_at NULLS LAST`, `created_at`. |
| UAT-11 | Compare cockpit counts with manager drill-down | Active, control-gap, overdue, due-soon and escalation totals reconcile. |
| UAT-12 | Execute the unauthorized-access matrix below | Every read returns exactly zero rows and every mutating function raises the stated authorization error; generic SQL, connection or syntax failure is a test failure. |
| UAT-13 | Repeat reconciliation and cockpit reads under concurrent intake updates | No duplicate terminal accounting, no negative counts and no silent terminal state. |
| UAT-14 | Execute the protected-write snapshot below before and after every scenario | Row fingerprints and insert/update/delete counters remain identical for every protected relation. |

## UAT-12 unauthorized-access matrix

Run with an authenticated user who is not accepted by `public.is_whatsapp_inbox_reader(auth.uid())`.

| Object | Invocation | Exact expected outcome |
|---|---|---|
| `public.whatsapp_business_intake_reconciliation` | `select * from public.whatsapp_business_intake_reconciliation;` | 0 rows. |
| `public.whatsapp_business_intake_reconciliation_exceptions` | `select * from public.whatsapp_business_intake_reconciliation_exceptions;` | 0 rows. |
| `public.whatsapp_business_intake_reconciliation_control` | `select * from public.whatsapp_business_intake_reconciliation_control;` | 0 rows. |
| `public.whatsapp_shift_reconciliation_readiness` | `select * from public.whatsapp_shift_reconciliation_readiness;` | 0 rows. |
| `public.whatsapp_operator_cockpit` | `select * from public.whatsapp_operator_cockpit;` | 0 rows. |
| `public.get_whatsapp_operator_cockpit(null, null, 100)` | `select * from public.get_whatsapp_operator_cockpit(null, null, 100);` | 0 rows. |
| `public.whatsapp_manager_drilldown` | `select * from public.whatsapp_manager_drilldown;` | 0 rows. |
| `public.get_whatsapp_manager_drilldown()` | `select * from public.get_whatsapp_manager_drilldown();` | 0 rows. |
| `public.get_whatsapp_business_intake_reconciliation_exceptions()` | `select * from public.get_whatsapp_business_intake_reconciliation_exceptions();` | 0 rows. |
| `public.escalate_whatsapp_business_intake(...)` | Call with an existing governed intake and authorized target. | Raises `not authorized`; intake owner, escalation rows and audit rows are unchanged. |
| `public.prepare_whatsapp_shift_reconciliation(...)` | Call with a unique test shift key. | Raises `not authorized`; no reconciliation row is inserted. |
| `public.signoff_whatsapp_shift_reconciliation(...)` | Call against a pending test reconciliation. | Raises `not authorized`; sign-off fields are unchanged. |

Record returned row counts or SQLSTATE/message for every row in this matrix. Do not treat an unavailable relation, malformed query, connection failure or unrelated permission error as a pass.

## UAT-14 protected-write snapshot

Create a temporary snapshot table in the UAT session. The relation list is exhaustive for this programme boundary; adapt only a physical table name that is demonstrably different in the deployed schema and record that mapping in the evidence.

```sql
create temporary table uat_protected_relation_snapshot as
with protected(rel) as (
  values
    ('public.orders'::regclass),
    ('public.order_items'::regclass),
    ('public.payments'::regclass),
    ('public.invoices'::regclass),
    ('public.inventory'::regclass),
    ('public.dispatch'::regclass),
    ('public.customers'::regclass),
    ('public.products'::regclass)
)
select
  rel,
  coalesce(s.n_tup_ins, 0) as n_tup_ins,
  coalesce(s.n_tup_upd, 0) as n_tup_upd,
  coalesce(s.n_tup_del, 0) as n_tup_del,
  pg_relation_size(rel) as relation_bytes,
  (select count(*) from pg_catalog.pg_visible_in_snapshot(txid_current_snapshot(), xmin)) as visible_row_marker
from protected p
left join pg_stat_all_tables s on s.relid = p.rel;
```

Because generic SQL cannot dynamically `count(*)` or hash arbitrary relations without dynamic execution, run this audited helper in the isolated UAT database to capture an exact row fingerprint before and after each scenario:

```sql
create or replace function pg_temp.protected_relation_fingerprint(p_rel regclass)
returns table(row_count bigint, row_hash text)
language plpgsql
as $$
begin
  return query execute format(
    'select count(*)::bigint, md5(coalesce(string_agg(md5(t::text), '''' order by md5(t::text)), '''')) from %s t',
    p_rel
  );
end;
$$;

select p.rel,
       f.row_count,
       f.row_hash,
       coalesce(s.n_tup_ins, 0) as n_tup_ins,
       coalesce(s.n_tup_upd, 0) as n_tup_upd,
       coalesce(s.n_tup_del, 0) as n_tup_del
from uat_protected_relation_snapshot p
cross join lateral pg_temp.protected_relation_fingerprint(p.rel) f
left join pg_stat_all_tables s on s.relid = p.rel
order by p.rel::text;
```

Capture this result immediately before and after every UAT scenario. Force statistics visibility with `select pg_stat_clear_snapshot();` before each capture. A pass requires identical `row_count`, `row_hash`, `n_tup_ins`, `n_tup_upd` and `n_tup_del` for all eight relations. Any delta is a protected-boundary failure, even when the final row count returns to its original value.

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