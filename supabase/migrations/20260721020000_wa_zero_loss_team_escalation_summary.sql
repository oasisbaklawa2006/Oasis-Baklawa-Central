-- Issue #232 read-only management escalation summary by accountable team.
-- Groups active-pending authorized-channel work without mutating operational truth.

begin;

create or replace function public.get_whatsapp_zero_loss_team_escalation_summary(
  stale_after interval default interval '24 hours'
)
returns table (
  accountable_team text,
  active_pending_count bigint,
  critical_count bigint,
  stale_count bigint,
  missing_owner_count bigint,
  missing_next_action_count bigint,
  unique_accountability_breach_count bigint,
  owned_actionable_stale_count bigint,
  oldest_detected_at timestamptz,
  oldest_age interval,
  team_zero_loss_clear boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp zero-loss team escalation summary';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  return query
  with pending as (
    select
      coalesce(nullif(btrim(q.assigned_team), ''), 'UNASSIGNED') as accountable_team,
      q.priority_rank,
      q.detected_at,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
      q.detected_at <= statement_timestamp() - stale_after as is_stale
    from public.whatsapp_authorized_channel_accountability_queue q
    where q.effective_disposition = 'ACTIVE_PENDING'
  ), grouped as (
    select
      p.accountable_team,
      count(*)::bigint as active_pending_count,
      count(*) filter (where p.priority_rank <= 20)::bigint as critical_count,
      count(*) filter (where p.is_stale)::bigint as stale_count,
      count(*) filter (where p.missing_owner)::bigint as missing_owner_count,
      count(*) filter (where p.missing_next_action)::bigint as missing_next_action_count,
      count(*) filter (where p.missing_owner or p.missing_next_action)::bigint as unique_accountability_breach_count,
      count(*) filter (
        where p.is_stale
          and not p.missing_owner
          and not p.missing_next_action
      )::bigint as owned_actionable_stale_count,
      min(p.detected_at) as oldest_detected_at
    from pending p
    group by p.accountable_team
  )
  select
    g.accountable_team,
    g.active_pending_count,
    g.critical_count,
    g.stale_count,
    g.missing_owner_count,
    g.missing_next_action_count,
    g.unique_accountability_breach_count,
    g.owned_actionable_stale_count,
    g.oldest_detected_at,
    statement_timestamp() - g.oldest_detected_at as oldest_age,
    (g.unique_accountability_breach_count = 0 and g.stale_count = 0) as team_zero_loss_clear
  from grouped g
  order by
    case when g.accountable_team = 'UNASSIGNED' then 0 else 1 end,
    g.unique_accountability_breach_count desc,
    g.stale_count desc,
    g.critical_count desc,
    g.oldest_detected_at asc,
    g.accountable_team asc;
end;
$$;

revoke all on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) from public;
revoke all on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) from anon;
grant execute on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) to authenticated;

comment on function public.get_whatsapp_zero_loss_team_escalation_summary(interval) is
  'Read-only Issue #232 management escalation summary grouped by accountable team, including unassigned, stale, critical, and uniquely breached active-pending work.';

commit;
