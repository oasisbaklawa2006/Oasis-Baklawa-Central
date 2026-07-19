-- Derived zero-loss reconciliation exception queue for governed WhatsApp B2B intakes.
-- Read-only control surface: never creates or mutates orders, order_items, finance,
-- inventory, or dispatch truth.

create or replace view public.whatsapp_business_intake_reconciliation_exceptions
with (security_invoker = true)
as
select
  i.id as intake_id,
  i.intake_kind,
  i.lifecycle_state,
  i.disposition,
  i.assigned_user_id,
  i.assigned_team,
  i.escalation_owner_user_id,
  i.next_action,
  i.sla_due_at,
  i.reconciliation_status,
  i.reconciliation_issue,
  i.sales_order_draft_id,
  i.sales_order_id,
  i.closure_reason,
  i.closed_by_user_id,
  i.closed_at,
  i.created_at,
  i.updated_at,
  exception_code,
  case
    when exception_code in (
      'EXPLICITLY_UNACCOUNTED',
      'ACTIVE_PENDING_OWNER_MISSING',
      'ACTIVE_PENDING_NEXT_ACTION_MISSING',
      'CONVERTED_LINK_MISSING',
      'EXPLICIT_CLOSURE_EVIDENCE_MISSING'
    ) then 'BREACH'
    when exception_code = 'ACTIVE_PENDING_OVERDUE' then 'OVERDUE'
    else 'CONTROL_GAP'
  end as exception_class
from public.whatsapp_business_intakes i
cross join lateral unnest(array_remove(array[
  case
    when i.reconciliation_status = 'UNACCOUNTED'
      then 'EXPLICITLY_UNACCOUNTED'
  end,
  case
    when i.disposition = 'ACTIVE_PENDING'
      and i.assigned_user_id is null
      and nullif(btrim(i.assigned_team), '') is null
      and i.escalation_owner_user_id is null
      then 'ACTIVE_PENDING_OWNER_MISSING'
  end,
  case
    when i.disposition = 'ACTIVE_PENDING'
      and nullif(btrim(i.next_action), '') is null
      then 'ACTIVE_PENDING_NEXT_ACTION_MISSING'
  end,
  case
    when i.disposition = 'ACTIVE_PENDING'
      and i.sla_due_at is null
      then 'ACTIVE_PENDING_SLA_MISSING'
  end,
  case
    when i.disposition = 'ACTIVE_PENDING'
      and i.sla_due_at < now()
      then 'ACTIVE_PENDING_OVERDUE'
  end,
  case
    when i.disposition = 'CONVERTED'
      and i.sales_order_draft_id is null
      and i.sales_order_id is null
      then 'CONVERTED_LINK_MISSING'
  end,
  case
    when i.disposition = 'EXPLICITLY_CLOSED'
      and (
        nullif(btrim(i.closure_reason), '') is null
        or i.closed_by_user_id is null
        or i.closed_at is null
      )
      then 'EXPLICIT_CLOSURE_EVIDENCE_MISSING'
  end,
  case
    when i.disposition = 'ACTIVE_PENDING'
      and i.lifecycle_state in ('CONVERTED_TO_SO', 'EXPLICITLY_CLOSED')
      then 'ILLEGAL_TERMINAL_STATE_PENDING'
  end,
  case
    when i.disposition = 'CONVERTED'
      and i.lifecycle_state <> 'CONVERTED_TO_SO'
      then 'CONVERTED_STATE_MISMATCH'
  end,
  case
    when i.disposition = 'EXPLICITLY_CLOSED'
      and i.lifecycle_state <> 'EXPLICITLY_CLOSED'
      then 'CLOSED_STATE_MISMATCH'
  end
]::text[], null)) as exception_code
where i.business_domain = 'B2B'
  and i.intake_kind in ('ORDER', 'POTENTIAL_ORDER', 'UNRESOLVED_RISK');

revoke all on public.whatsapp_business_intake_reconciliation_exceptions from public;
revoke all on public.whatsapp_business_intake_reconciliation_exceptions from anon;
grant select on public.whatsapp_business_intake_reconciliation_exceptions to authenticated;

create or replace function public.get_whatsapp_business_intake_reconciliation_exceptions()
returns table (
  intake_id uuid,
  exception_code text,
  exception_class text,
  lifecycle_state text,
  disposition text,
  assigned_user_id uuid,
  assigned_team text,
  escalation_owner_user_id uuid,
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
    exception_code,
    exception_class,
    lifecycle_state,
    disposition,
    assigned_user_id,
    assigned_team,
    escalation_owner_user_id,
    next_action,
    sla_due_at,
    reconciliation_issue,
    updated_at
  from public.whatsapp_business_intake_reconciliation_exceptions
  order by
    case exception_class when 'BREACH' then 0 when 'OVERDUE' then 1 else 2 end,
    sla_due_at nulls last,
    updated_at asc,
    intake_id;
$$;

revoke all on function public.get_whatsapp_business_intake_reconciliation_exceptions() from public;
revoke all on function public.get_whatsapp_business_intake_reconciliation_exceptions() from anon;
grant execute on function public.get_whatsapp_business_intake_reconciliation_exceptions() to authenticated;

create or replace view public.whatsapp_business_intake_reconciliation_control
with (security_invoker = true)
as
select
  r.potential_received,
  r.converted,
  r.active_pending,
  r.explicitly_closed,
  r.unaccounted_potential_orders,
  count(distinct e.intake_id) filter (where e.exception_class = 'BREACH')::bigint as derived_breach_intakes,
  count(distinct e.intake_id) filter (where e.exception_class = 'OVERDUE')::bigint as overdue_intakes,
  count(distinct e.intake_id) filter (where e.exception_class = 'CONTROL_GAP')::bigint as control_gap_intakes,
  count(distinct e.intake_id)::bigint as total_exception_intakes
from public.whatsapp_business_intake_reconciliation r
left join public.whatsapp_business_intake_reconciliation_exceptions e on true
group by
  r.potential_received,
  r.converted,
  r.active_pending,
  r.explicitly_closed,
  r.unaccounted_potential_orders;

revoke all on public.whatsapp_business_intake_reconciliation_control from public;
revoke all on public.whatsapp_business_intake_reconciliation_control from anon;
grant select on public.whatsapp_business_intake_reconciliation_control to authenticated;

comment on view public.whatsapp_business_intake_reconciliation_exceptions is
  'RLS-preserving exception queue deriving zero-loss breaches, overdue work, and control gaps from governed B2B WhatsApp intakes without downstream operational writes.';
comment on view public.whatsapp_business_intake_reconciliation_control is
  'Programme control summary combining the canonical disposition equation with derived breach, overdue, and control-gap intake counts.';