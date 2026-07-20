-- Issue #232 read-only stale accountability escalation summary.
-- Provides an aggregate operator surface over every stale ACTIVE_PENDING item.
-- No source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_authorized_channel_stale_accountability_summary(
  stale_after interval default interval '24 hours'
)
returns table (
  stale_count bigint,
  critical_stale_count bigint,
  unowned_stale_count bigint,
  actionless_stale_count bigint,
  unique_accountability_breach_count bigint,
  owned_actionable_stale_count bigint,
  oldest_detected_at timestamptz,
  oldest_age interval,
  stale_queue_is_zero boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read stale WhatsApp accountability summary';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  return query
  with stale as (
    select
      q.priority_rank,
      q.assigned_team,
      q.effective_next_action,
      q.detected_at,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action
    from public.whatsapp_authorized_channel_accountability_queue q
    where q.effective_disposition = 'ACTIVE_PENDING'
      and q.detected_at <= statement_timestamp() - stale_after
  ), counts as (
    select
      count(*)::bigint as stale_count,
      count(*) filter (where priority_rank <= 20)::bigint as critical_stale_count,
      count(*) filter (where missing_owner)::bigint as unowned_stale_count,
      count(*) filter (where missing_next_action)::bigint as actionless_stale_count,
      count(*) filter (where missing_owner or missing_next_action)::bigint as unique_accountability_breach_count,
      count(*) filter (where not missing_owner and not missing_next_action)::bigint as owned_actionable_stale_count,
      min(detected_at) as oldest_detected_at
    from stale
  )
  select
    c.stale_count,
    c.critical_stale_count,
    c.unowned_stale_count,
    c.actionless_stale_count,
    c.unique_accountability_breach_count,
    c.owned_actionable_stale_count,
    c.oldest_detected_at,
    case
      when c.oldest_detected_at is null then null
      else statement_timestamp() - c.oldest_detected_at
    end as oldest_age,
    c.stale_count = 0 as stale_queue_is_zero
  from counts c;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) from public;
revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) from anon;
grant execute on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) to authenticated;

comment on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) is
  'Read-only Issue #232 operator summary of stale ACTIVE_PENDING authorized-channel accountability items, separating unique missing-accountability breaches from owned/actionable stalled work.';

commit;
