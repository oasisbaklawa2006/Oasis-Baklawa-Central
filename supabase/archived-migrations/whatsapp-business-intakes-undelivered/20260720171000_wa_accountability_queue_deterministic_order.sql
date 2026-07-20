-- Issue #232 forward repair: make bounded accountability queue selection deterministic.
-- Replaces only the read function; the underlying view and operational truth are untouched.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_queue(
  include_closed boolean default false,
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
  effective_disposition text,
  assigned_team text,
  effective_next_action text,
  closure_reason text,
  evidence jsonb,
  detected_at timestamptz,
  resolved_at timestamptz,
  priority_rank integer
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read the WhatsApp accountability queue';
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
    q.effective_disposition,
    q.assigned_team,
    q.effective_next_action,
    q.closure_reason,
    q.evidence,
    q.detected_at,
    q.resolved_at,
    q.priority_rank
  from public.whatsapp_authorized_channel_accountability_queue q
  where include_closed or q.effective_disposition = 'ACTIVE_PENDING'
  order by
    q.priority_rank asc,
    q.detected_at asc,
    q.source_message_id asc nulls last,
    q.item_source asc,
    q.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) is
  'Returns the deterministic Issue #232 accountability queue. Bounded selection uses non-null lineage tiebreakers after priority, age, and optional source message ordering.';

commit;
