-- Issue #232 read-only register of uniquely unaccounted authorized-channel items.
-- A breach is one ACTIVE_PENDING item missing ownership or a concrete next action.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_breach_register(
  stale_after interval default interval '24 hours',
  result_limit integer default 200
)
returns table (
  item_source text,
  source_record_id uuid,
  source_message_id uuid,
  existing_intake_id uuid,
  provider_message_id text,
  receiver_channel_id text,
  accountability_state text,
  assigned_team text,
  effective_next_action text,
  missing_owner boolean,
  missing_next_action boolean,
  is_stale boolean,
  detected_at timestamptz,
  priority_rank integer,
  evidence jsonb
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read the WhatsApp accountability breach register';
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
    q.receiver_channel_id,
    q.accountability_state,
    q.assigned_team,
    q.effective_next_action,
    nullif(btrim(q.assigned_team), '') is null as missing_owner,
    nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
    q.detected_at <= statement_timestamp() - stale_after as is_stale,
    q.detected_at,
    q.priority_rank,
    q.evidence
  from public.whatsapp_authorized_channel_accountability_queue q
  where q.effective_disposition = 'ACTIVE_PENDING'
    and (
      nullif(btrim(q.assigned_team), '') is null
      or nullif(btrim(q.effective_next_action), '') is null
    )
  order by
    q.priority_rank asc,
    (q.detected_at <= statement_timestamp() - stale_after) desc,
    q.detected_at asc,
    q.item_source asc,
    q.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) is
  'Read-only Issue #232 register returning each ACTIVE_PENDING authorized-channel item exactly once when ownership or next action is missing, with stale-state evidence and bounded deterministic ordering.';

commit;
