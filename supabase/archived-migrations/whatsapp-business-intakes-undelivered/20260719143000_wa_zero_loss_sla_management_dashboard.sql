-- Read-only management dashboard for governed WhatsApp B2B potential-order intake.
-- Preserves source RLS through security-invoker views and performs no operational writes.

create or replace view public.whatsapp_business_intake_sla_management_dashboard
with (security_invoker = true)
as
with governed as (
  select
    i.id,
    i.disposition,
    i.assigned_user_id,
    i.assigned_team,
    i.escalation_owner_user_id,
    i.sla_due_at,
    i.updated_at,
    case
      when i.disposition <> 'ACTIVE_PENDING' then 'NOT_PENDING'
      when i.sla_due_at is null then 'SLA_MISSING'
      when i.sla_due_at < now() - interval '24 hours' then 'OVERDUE_24H_PLUS'
      when i.sla_due_at < now() then 'OVERDUE_UNDER_24H'
      when i.sla_due_at <= now() + interval '4 hours' then 'DUE_WITHIN_4H'
      else 'ON_TRACK'
    end as sla_bucket,
    case
      when i.disposition = 'ACTIVE_PENDING'
       and i.assigned_user_id is null
       and nullif(btrim(i.assigned_team), '') is null
       and i.escalation_owner_user_id is null
      then true else false
    end as owner_missing,
    case
      when exists (
        select 1
        from public.whatsapp_business_intake_reconciliation_exceptions e
        where e.intake_id = i.id
          and e.exception_class = 'BREACH'
      ) then true else false
    end as has_breach
  from public.whatsapp_business_intakes i
  where i.business_domain = 'B2B'
    and i.intake_kind in ('ORDER', 'POTENTIAL_ORDER', 'UNRESOLVED_RISK')
)
select
  count(*)::bigint as potential_received,
  count(*) filter (where disposition = 'CONVERTED')::bigint as converted,
  count(*) filter (where disposition = 'ACTIVE_PENDING')::bigint as active_pending,
  count(*) filter (where disposition = 'EXPLICITLY_CLOSED')::bigint as explicitly_closed,
  count(*) filter (where disposition is null or disposition not in ('CONVERTED', 'ACTIVE_PENDING', 'EXPLICITLY_CLOSED'))::bigint as unaccounted_potential_orders,
  count(*) filter (where has_breach)::bigint as breach_intakes,
  count(*) filter (where owner_missing)::bigint as owner_missing_intakes,
  count(*) filter (where sla_bucket = 'SLA_MISSING')::bigint as sla_missing_intakes,
  count(*) filter (where sla_bucket = 'OVERDUE_24H_PLUS')::bigint as overdue_24h_plus,
  count(*) filter (where sla_bucket = 'OVERDUE_UNDER_24H')::bigint as overdue_under_24h,
  count(*) filter (where sla_bucket = 'DUE_WITHIN_4H')::bigint as due_within_4h,
  count(*) filter (where sla_bucket = 'ON_TRACK')::bigint as on_track,
  min(sla_due_at) filter (where disposition = 'ACTIVE_PENDING') as oldest_pending_sla_due_at,
  min(updated_at) filter (where disposition = 'ACTIVE_PENDING') as oldest_pending_updated_at
from governed;

revoke all on public.whatsapp_business_intake_sla_management_dashboard from public;
revoke all on public.whatsapp_business_intake_sla_management_dashboard from anon;
grant select on public.whatsapp_business_intake_sla_management_dashboard to authenticated;

comment on view public.whatsapp_business_intake_sla_management_dashboard is
  'RLS-preserving, read-only management summary for zero-loss WhatsApp B2B intake, including accounting equation, breach, ownership, and deterministic SLA ageing buckets.';
