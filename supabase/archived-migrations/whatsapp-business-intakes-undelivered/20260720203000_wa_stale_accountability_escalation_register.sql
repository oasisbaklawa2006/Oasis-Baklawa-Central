-- Issue #232 read-only stale accountability escalation register.
-- Surfaces every active-pending item older than the caller threshold, including owned/actionable work.
-- No source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_authorized_channel_stale_accountability_escalations(
  stale_after interval default interval '24 hours',
  result_limit integer default 200
)
returns table (
  item_source text,
  source_record_id uuid,
  source_message_id uuid,
  existing_intake_id uuid,
  provider_message_id text,
  provider text,
  receiver_channel_id text,
  accountability_state text,
  assigned_team text,
  effective_next_action text,
  missing_owner boolean,
  missing_next_action boolean,
  evidence jsonb,
  detected_at timestamptz,
  age interval,
  priority_rank integer
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read stale WhatsApp accountability escalations';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  if result_limit is null or result_limit < 1 or result_limit > 1000 then
    raise exception 'result_limit must be between 1 and 1000';
  end if;

  return query
  select
    q.item_source,
    q.source_record_id,
    q.source_message_id,
    q.existing_intake_id,
    q.provider_message_id,
    q.provider,
    q.receiver_channel_id,
    q.accountability_state,
    q.assigned_team,
    q.effective_next_action,
    nullif(btrim(q.assigned_team), '') is null as missing_owner,
    nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
    q.evidence,
    q.detected_at,
    statement_timestamp() - q.detected_at as age,
    q.priority_rank
  from public.whatsapp_authorized_channel_accountability_queue q
  where q.effective_disposition = 'ACTIVE_PENDING'
    and q.detected_at <= statement_timestamp() - stale_after
  order by
    q.detected_at asc,
    q.priority_rank asc,
    q.item_source asc,
    q.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) from public;
revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) from anon;
grant execute on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) to authenticated;

comment on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) is
  'Read-only Issue #232 register of every ACTIVE_PENDING authorized-channel accountability item older than the caller threshold, preserving owner, required next action, age, evidence, and unique source lineage.';

commit;
