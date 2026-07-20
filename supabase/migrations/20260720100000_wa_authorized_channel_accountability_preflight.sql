-- Issue #232 read-only preflight for the zero-loss authorized-channel invariant.
-- Reports unresolved, unowned, actionless, critical, and stale accountability items.
-- No source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_preflight(
  stale_after interval default interval '24 hours'
)
returns table (
  unresolved_count bigint,
  critical_count bigint,
  unowned_count bigint,
  actionless_count bigint,
  stale_count bigint,
  invariant_breach_count bigint,
  metric_is_zero boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read the WhatsApp accountability preflight';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  return query
  with pending as (
    select
      q.priority_rank,
      q.assigned_team,
      q.effective_next_action,
      q.detected_at
    from public.whatsapp_authorized_channel_accountability_queue q
    where q.effective_disposition = 'ACTIVE_PENDING'
  ), counts as (
    select
      count(*)::bigint as unresolved_count,
      count(*) filter (where priority_rank <= 20)::bigint as critical_count,
      count(*) filter (where nullif(btrim(assigned_team), '') is null)::bigint as unowned_count,
      count(*) filter (where nullif(btrim(effective_next_action), '') is null)::bigint as actionless_count,
      count(*) filter (where detected_at <= statement_timestamp() - stale_after)::bigint as stale_count
    from pending
  )
  select
    c.unresolved_count,
    c.critical_count,
    c.unowned_count,
    c.actionless_count,
    c.stale_count,
    (c.unowned_count + c.actionless_count)::bigint as invariant_breach_count,
    (c.unowned_count + c.actionless_count) = 0 as metric_is_zero
  from counts c;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) is
  'Read-only Issue #232 preflight. metric_is_zero is true only when every unresolved authorized-channel accountability item has both ownership and a next action. stale_after is caller-selectable and defaults to 24 hours.';

commit;
