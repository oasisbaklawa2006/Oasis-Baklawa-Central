# WhatsApp Zero-Loss Final UAT

## Purpose

Validate the Issue #232 control plane end to end without writing to orders, order items, payments, invoices, inventory, dispatch, customer master or product master.

## Entry criteria

- Intake foundation migration applied.
- Reconciliation exception migration applied.
- Escalation and shift reconciliation migration applied.
- Operator cockpit and manager drill-down migration applied.
- Test users exist for operator, alternate operator, supervisor and unauthorized user.
- Canonical protected relations exist exactly as `public.orders`, `public.order_items`, `public.payments`, `public.invoices`, `public.inventory`, `public.dispatch`, `public.customers`, and `public.products`. A differently named deployment must be normalized before this UAT; alternate names are not accepted silently.

## Mandatory scenarios

| ID | Scenario | Expected result |
|---|---|---|
| UAT-01 | Create a potential order intake without customer attribution | Intake remains visible as a control gap and cannot silently disappear. |
| UAT-02 | Move a valid intake to ACTIVE_PENDING with next action and due time | Intake appears in operator cockpit with deterministic priority. |
| UAT-03 | Let an ACTIVE_PENDING intake cross its due time | Intake becomes overdue and manager totals increment. |
| UAT-04 | Escalate an ACTIVE_PENDING intake to an authorized alternate owner | Ownership lineage, reason, severity and open escalation are visible; audit evidence is appended. |
| UAT-05 | Attempt escalation to an unauthorized target | Function raises `target owner is not authorized`; current owner and open-escalation state remain unchanged. |
| UAT-06 | Create a second escalation for the same intake | Previous open escalation is resolved as superseded; only one open escalation remains. |
| UAT-07 | Prepare shift reconciliation while unaccounted intakes remain | Readiness is false and `SIGNED_OFF` raises `shift is not clean for sign-off`. |
| UAT-08 | Attempt self-certification by the preparer | Sign-off raises `preparer cannot self-certify shift reconciliation`; reconciliation remains `PENDING`. |
| UAT-09 | Resolve all control gaps and open escalations, then sign off as supervisor | Canonical equation balances and sign-off evidence is recorded. |
| UAT-10 | Filter cockpit by operator and team | Results remain bounded to authorized rows and ordering remains stable by `priority_rank`, `sla_due_at NULLS LAST`, `created_at`. |
| UAT-11 | Compare cockpit counts with manager drill-down | Active, control-gap, overdue, due-soon and escalation totals reconcile. |
| UAT-12 | Execute the unauthorized-access matrix below | Every read returns exactly zero rows and every mutation raises SQLSTATE `P0001` with message `not authorized`; generic SQL, connection or syntax failure is a test failure. |
| UAT-13 | Repeat reconciliation and cockpit reads under concurrent intake updates | No duplicate terminal accounting, no negative counts and no silent terminal state. |
| UAT-14 | Execute the protected-write snapshot below before and after every scenario | Row fingerprints and insert/update/delete counters remain identical for every protected relation. |

## UAT-12 unauthorized-access matrix

Run as an authenticated user for whom `public.is_whatsapp_inbox_reader(auth.uid())` returns `false`. Set reproducible psql variables before executing the matrix:

```sql
\set uat_intake_id '00000000-0000-0000-0000-000000000101'
\set uat_authorized_target_id '00000000-0000-0000-0000-000000000102'
\set uat_reconciliation_id '00000000-0000-0000-0000-000000000103'
\set uat_shift_key 'UAT-12-UNAUTHORIZED-001'
```

The fixture setup, performed by an authorized administrator before switching to the unauthorized actor, must create:

- an `ACTIVE_PENDING` intake with id `:uat_intake_id`;
- an authorized alternate owner with id `:uat_authorized_target_id`;
- a pending reconciliation with id `:uat_reconciliation_id`;
- no reconciliation row using `:uat_shift_key`.

| Object | Exact invocation | Exact expected outcome |
|---|---|---|
| `public.whatsapp_business_intake_reconciliation` | `select * from public.whatsapp_business_intake_reconciliation;` | Exactly 0 rows. |
| `public.whatsapp_business_intake_reconciliation_exceptions` | `select * from public.whatsapp_business_intake_reconciliation_exceptions;` | Exactly 0 rows. |
| `public.whatsapp_business_intake_reconciliation_control` | `select * from public.whatsapp_business_intake_reconciliation_control;` | Exactly 0 rows. |
| `public.whatsapp_shift_reconciliation_readiness` | `select * from public.whatsapp_shift_reconciliation_readiness;` | Exactly 0 rows. |
| `public.whatsapp_operator_cockpit` | `select * from public.whatsapp_operator_cockpit;` | Exactly 0 rows. |
| `public.get_whatsapp_operator_cockpit(null, null, 100)` | `select * from public.get_whatsapp_operator_cockpit(null, null, 100);` | Exactly 0 rows. |
| `public.whatsapp_manager_drilldown` | `select * from public.whatsapp_manager_drilldown;` | Exactly 0 rows. |
| `public.get_whatsapp_manager_drilldown()` | `select * from public.get_whatsapp_manager_drilldown();` | Exactly 0 rows. |
| `public.get_whatsapp_business_intake_reconciliation_exceptions()` | `select * from public.get_whatsapp_business_intake_reconciliation_exceptions();` | Exactly 0 rows. |
| `public.escalate_whatsapp_business_intake(uuid,uuid,text,text)` | `select public.escalate_whatsapp_business_intake(:'uat_intake_id'::uuid, :'uat_authorized_target_id'::uuid, 'UAT unauthorized escalation', 'WARNING');` | SQLSTATE `P0001`; message exactly `not authorized`. Intake `assigned_user_id`, `escalation_owner_user_id`, `next_action`, open escalation rows, and intake audit rows remain byte-for-byte unchanged. |
| `public.prepare_whatsapp_shift_reconciliation(text,timestamptz,timestamptz)` | `select public.prepare_whatsapp_shift_reconciliation(:'uat_shift_key', timestamptz '2026-07-19 00:00:00+00', timestamptz '2026-07-19 08:00:00+00');` | SQLSTATE `P0001`; message exactly `not authorized`. No row exists with `shift_key = :'uat_shift_key'`. |
| `public.signoff_whatsapp_shift_reconciliation(uuid,text,text)` | `select public.signoff_whatsapp_shift_reconciliation(:'uat_reconciliation_id'::uuid, 'REJECTED', 'UAT unauthorized sign-off');` | SQLSTATE `P0001`; message exactly `not authorized`. `signoff_status`, `supervisor_user_id`, `supervisor_note`, and `signed_off_at` remain unchanged. |

For each mutation, capture the before snapshot in the same transaction, establish a savepoint, invoke the function, assert SQLSTATE/message in the test harness, roll back to the savepoint, and compare the after snapshot. An unavailable relation, malformed query, connection failure, syntax failure, or unrelated permission error is a failure.

## UAT-14 protected-write snapshot

The canonical relation list is exhaustive for this programme boundary. The preflight must return eight non-null `regclass` values.

```sql
create temporary table uat_protected_relations(
  canonical_name text primary key,
  physical_rel regclass not null
) on commit preserve rows;

insert into uat_protected_relations(canonical_name, physical_rel) values
  ('orders', 'public.orders'::regclass),
  ('order_items', 'public.order_items'::regclass),
  ('payments', 'public.payments'::regclass),
  ('invoices', 'public.invoices'::regclass),
  ('inventory', 'public.inventory'::regclass),
  ('dispatch', 'public.dispatch'::regclass),
  ('customers', 'public.customers'::regclass),
  ('products', 'public.products'::regclass);

select canonical_name, physical_rel
from uat_protected_relations
order by canonical_name;
```

Create the fingerprint helper in the isolated UAT database:

```sql
create or replace function pg_temp.protected_relation_fingerprint(p_rel regclass)
returns table(row_count bigint, row_hash text)
language plpgsql
as $$
begin
  return query execute format(
    'select count(*)::bigint,
            md5(coalesce(string_agg(md5(t::text), '''' order by md5(t::text)), ''''))
       from %s t',
    p_rel
  );
end;
$$;
```

Capture the **before** snapshot immediately before each scenario. Both snapshots reuse `uat_protected_relations`; no relation names are repeated or remapped later.

```sql
drop table if exists uat_protected_before;
select pg_stat_clear_snapshot();

create temporary table uat_protected_before as
select
  p.canonical_name,
  p.physical_rel,
  f.row_count,
  f.row_hash,
  coalesce(s.n_tup_ins, 0) as n_tup_ins,
  coalesce(s.n_tup_upd, 0) as n_tup_upd,
  coalesce(s.n_tup_del, 0) as n_tup_del
from uat_protected_relations p
cross join lateral pg_temp.protected_relation_fingerprint(p.physical_rel) f
left join pg_stat_all_tables s on s.relid = p.physical_rel;
```

Capture and compare the **after** snapshot after the scenario commits:

```sql
select pg_stat_clear_snapshot();

with after_snapshot as (
  select
    p.canonical_name,
    p.physical_rel,
    f.row_count,
    f.row_hash,
    coalesce(s.n_tup_ins, 0) as n_tup_ins,
    coalesce(s.n_tup_upd, 0) as n_tup_upd,
    coalesce(s.n_tup_del, 0) as n_tup_del
  from uat_protected_relations p
  cross join lateral pg_temp.protected_relation_fingerprint(p.physical_rel) f
  left join pg_stat_all_tables s on s.relid = p.physical_rel
)
select
  a.canonical_name,
  b.physical_rel = a.physical_rel as relation_unchanged,
  b.row_count = a.row_count as row_count_unchanged,
  b.row_hash = a.row_hash as row_hash_unchanged,
  b.n_tup_ins = a.n_tup_ins as inserts_unchanged,
  b.n_tup_upd = a.n_tup_upd as updates_unchanged,
  b.n_tup_del = a.n_tup_del as deletes_unchanged
from after_snapshot a
join uat_protected_before b using (canonical_name)
order by a.canonical_name;
```

A pass requires all six comparison columns to be `true` for all eight relations. The row hash detects changed content even when row counts are restored; PostgreSQL statistics counters expose transient insert/update/delete activity. Any delta is a protected-boundary failure.

## Stress checks

1. Seed at least 1,000 governed intake rows across multiple teams and operators.
2. Include mixed due states: control gap, breach, overdue, due soon and healthy pending.
3. Include multiple historical escalations while preserving one-open-escalation-per-intake.
4. Run cockpit and manager queries repeatedly while changing due states and resolving escalations.
5. Confirm deterministic ordering for equal-priority rows.
6. Confirm reconciliation totals remain additive and satisfy `potential_received = converted + active_pending + explicitly_closed`.

## Exit criteria

- All mandatory scenarios pass.
- No unresolved HIGH or MEDIUM review finding remains.
- Required GitHub checks succeed on the exact PR head.
- No protected downstream write is observed.
- UAT evidence records actor, timestamp, scenario ID, result and supporting query or screenshot.
