-- Zero-loss accountability ledger for authorized-channel B2B potential orders.
-- Read-only derived control surface. Does not create or mutate order, finance,
-- inventory, dispatch, customer-master, or product-master truth.

create or replace view public.whatsapp_business_intake_accountability_ledger
with (security_invoker = true)
as
select
  i.id as intake_id,
  i.intake_kind,
  i.lifecycle_state,
  i.disposition,
  coalesce(i.assigned_user_id, i.escalation_owner_user_id) as accountable_user_id,
  nullif(btrim(i.assigned_team), '') as accountable_team,
  nullif(btrim(i.next_action), '') as next_action,
  i.sla_due_at,
  i.reconciliation_status,
  i.reconciliation_issue,
  i.sales_order_draft_id,
  i.sales_order_id,
  nullif(btrim(i.closure_reason), '') as closure_reason,
  i.closed_by_user_id,
  i.closed_at,
  i.created_at,
  i.updated_at,
  case
    when i.reconciliation_status = 'UNACCOUNTED' then 'UNACCOUNTED'
    when i.disposition = 'ACTIVE_PENDING'
      and coalesce(i.assigned_user_id, i.escalation_owner_user_id) is null
      and nullif(btrim(i.assigned_team), '') is null then 'OWNER_MISSING'
    when i.disposition = 'ACTIVE_PENDING'
      and nullif(btrim(i.next_action), '') is null then 'NEXT_ACTION_MISSING'
    when i.disposition = 'ACTIVE_PENDING'
      and i.sla_due_at is null then 'SLA_MISSING'
    when i.disposition = 'ACTIVE_PENDING'
      and i.sla_due_at < now() then 'OVERDUE'
    when i.disposition = 'CONVERTED'
      and i.sales_order_draft_id is null
      and i.sales_order_id is null then 'CONVERSION_LINEAGE_MISSING'
    when i.disposition = 'EXPLICITLY_CLOSED'
      and (
        nullif(btrim(i.closure_reason), '') is null
        or i.closed_by_user_id is null
        or i.closed_at is null
      ) then 'CLOSURE_EVIDENCE_MISSING'
    else 'ACCOUNTED'
  end as accountability_state
from public.whatsapp_business_intakes i
where i.business_domain = 'B2B'
  and i.intake_kind in ('ORDER', 'POTENTIAL_ORDER', 'UNRESOLVED_RISK');

revoke all on public.whatsapp_business_intake_accountability_ledger from public;
revoke all on public.whatsapp_business_intake_accountability_ledger from anon;
grant select on public.whatsapp_business_intake_accountability_ledger to authenticated;

create or replace view public.whatsapp_business_intake_accountability_control
with (security_invoker = true)
as
select
  count(*)::bigint as potential_order_intakes,
  count(*) filter (where accountability_state = 'ACCOUNTED')::bigint as accounted_intakes,
  count(*) filter (where accountability_state = 'UNACCOUNTED')::bigint as unaccounted_intakes,
  count(*) filter (where accountability_state = 'OWNER_MISSING')::bigint as owner_missing_intakes,
  count(*) filter (where accountability_state = 'NEXT_ACTION_MISSING')::bigint as next_action_missing_intakes,
  count(*) filter (where accountability_state = 'SLA_MISSING')::bigint as sla_missing_intakes,
  count(*) filter (where accountability_state = 'OVERDUE')::bigint as overdue_intakes,
  count(*) filter (where accountability_state = 'CONVERSION_LINEAGE_MISSING')::bigint as conversion_lineage_missing_intakes,
  count(*) filter (where accountability_state = 'CLOSURE_EVIDENCE_MISSING')::bigint as closure_evidence_missing_intakes,
  count(*) filter (where accountability_state <> 'ACCOUNTED')::bigint as total_accountability_exceptions,
  (count(*) filter (where accountability_state <> 'ACCOUNTED') = 0) as zero_loss_invariant_holds
from public.whatsapp_business_intake_accountability_ledger;

revoke all on public.whatsapp_business_intake_accountability_control from public;
revoke all on public.whatsapp_business_intake_accountability_control from anon;
grant select on public.whatsapp_business_intake_accountability_control to authenticated;

create or replace function public.get_whatsapp_business_intake_accountability_exceptions()
returns table (
  intake_id uuid,
  accountability_state text,
  lifecycle_state text,
  disposition text,
  accountable_user_id uuid,
  accountable_team text,
  next_action text,
  sla_due_at timestamptz,
  reconciliation_issue text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    intake_id,
    accountability_state,
    lifecycle_state,
    disposition,
    accountable_user_id,
    accountable_team,
    next_action,
    sla_due_at,
    reconciliation_issue,
    updated_at
  from public.whatsapp_business_intake_accountability_ledger
  where accountability_state <> 'ACCOUNTED'
  order by
    case accountability_state
      when 'UNACCOUNTED' then 0
      when 'OWNER_MISSING' then 1
      when 'NEXT_ACTION_MISSING' then 2
      when 'CONVERSION_LINEAGE_MISSING' then 3
      when 'CLOSURE_EVIDENCE_MISSING' then 4
      when 'OVERDUE' then 5
      else 6
    end,
    sla_due_at nulls last,
    updated_at asc,
    intake_id;
$$;

revoke all on function public.get_whatsapp_business_intake_accountability_exceptions() from public;
revoke all on function public.get_whatsapp_business_intake_accountability_exceptions() from anon;
grant execute on function public.get_whatsapp_business_intake_accountability_exceptions() to authenticated;

comment on view public.whatsapp_business_intake_accountability_ledger is
  'Canonical read-only accountability ledger for authorized-channel B2B potential orders. Every row is classified as accounted or assigned one deterministic zero-loss exception state.';
comment on view public.whatsapp_business_intake_accountability_control is
  'Executive zero-loss control summary. zero_loss_invariant_holds is true only when no authorized-channel potential order lacks ownership, next action, SLA, conversion lineage, or closure evidence.';
