-- WhatsApp zero-loss operator cockpit and manager drill-down.
-- Additive, read-only control-plane views over governed intake and escalation state.

create or replace view public.whatsapp_operator_cockpit
with (security_invoker = true)
as
select
  i.id as intake_id,
  i.created_at,
  i.updated_at,
  i.intake_kind,
  i.lifecycle_state,
  i.disposition,
  i.assigned_user_id,
  i.assigned_team,
  i.escalation_owner_user_id,
  i.next_action,
  i.sla_due_at,
  case
    when i.disposition <> 'ACTIVE_PENDING' then 'TERMINAL'
    when i.reconciliation_status = 'UNACCOUNTED' then 'CONTROL_GAP'
    when i.sla_due_at is not null and i.sla_due_at < now() then 'OVERDUE'
    when i.sla_due_at is not null and i.sla_due_at <= now() + interval '30 minutes' then 'DUE_SOON'
    else 'ON_TRACK'
  end as queue_health,
  e.id as open_escalation_id,
  e.severity as escalation_severity,
  e.escalation_reason,
  e.to_owner_user_id as escalation_to_owner_user_id,
  e.acknowledged_at as escalation_acknowledged_at,
  extract(epoch from (now() - i.created_at))::bigint as age_seconds,
  case
    when i.disposition <> 'ACTIVE_PENDING' then 99
    when i.reconciliation_status = 'UNACCOUNTED' then 1
    when e.id is not null and e.severity = 'BREACH' then 2
    when i.sla_due_at is not null and i.sla_due_at < now() then 3
    when e.id is not null then 4
    when i.sla_due_at is not null and i.sla_due_at <= now() + interval '30 minutes' then 5
    else 10
  end as priority_rank
from public.whatsapp_business_intakes i
left join public.whatsapp_business_intake_escalations e
  on e.intake_id = i.id
 and e.resolved_at is null
where i.disposition = 'ACTIVE_PENDING';

grant select on public.whatsapp_operator_cockpit to authenticated;

create or replace function public.get_whatsapp_operator_cockpit(
  p_assigned_user_id uuid default null,
  p_assigned_team text default null,
  p_limit integer default 100
)
returns setof public.whatsapp_operator_cockpit
language sql
stable
security invoker
set search_path = public
as $$
  select c.*
  from public.whatsapp_operator_cockpit c
  where (p_assigned_user_id is null or c.assigned_user_id = p_assigned_user_id)
    and (p_assigned_team is null or c.assigned_team = p_assigned_team)
  order by c.priority_rank, c.sla_due_at nulls last, c.created_at
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

grant execute on function public.get_whatsapp_operator_cockpit(uuid, text, integer) to authenticated;

create or replace view public.whatsapp_manager_drilldown
with (security_invoker = true)
as
select
  coalesce(i.assigned_team, 'UNASSIGNED') as assigned_team,
  i.assigned_user_id,
  count(*)::bigint as active_pending,
  count(*) filter (where i.reconciliation_status = 'UNACCOUNTED')::bigint as control_gaps,
  count(*) filter (where i.sla_due_at is not null and i.sla_due_at < now())::bigint as overdue,
  count(*) filter (where i.sla_due_at is not null and i.sla_due_at between now() and now() + interval '30 minutes')::bigint as due_soon,
  count(*) filter (where e.id is not null)::bigint as open_escalations,
  count(*) filter (where e.id is not null and e.acknowledged_at is null)::bigint as unacknowledged_escalations,
  min(i.created_at) as oldest_opened_at,
  min(i.sla_due_at) filter (where i.sla_due_at is not null) as nearest_sla_due_at,
  max(extract(epoch from (now() - i.created_at)))::bigint as oldest_age_seconds
from public.whatsapp_business_intakes i
left join public.whatsapp_business_intake_escalations e
  on e.intake_id = i.id
 and e.resolved_at is null
where i.disposition = 'ACTIVE_PENDING'
group by coalesce(i.assigned_team, 'UNASSIGNED'), i.assigned_user_id;

grant select on public.whatsapp_manager_drilldown to authenticated;

create or replace function public.get_whatsapp_manager_drilldown()
returns setof public.whatsapp_manager_drilldown
language sql
stable
security invoker
set search_path = public
as $$
  select d.*
  from public.whatsapp_manager_drilldown d
  order by d.control_gaps desc,
           d.overdue desc,
           d.open_escalations desc,
           d.oldest_opened_at nulls last;
$$;

grant execute on function public.get_whatsapp_manager_drilldown() to authenticated;

comment on view public.whatsapp_operator_cockpit is
  'Read-only zero-loss operator queue. Orders ACTIVE_PENDING work by control gap, breach, overdue, escalation and due-soon priority.';
comment on view public.whatsapp_manager_drilldown is
  'Read-only manager aggregation by team and operator for active pending, SLA and escalation supervision.';