-- Issue #232 operator-facing authorized-channel accountability queue.
-- Unifies current capture exceptions and immutable historical reconciliation
-- into one read-only, RLS-preserving surface. No operational truth is mutated.

begin;

create view public.whatsapp_authorized_channel_accountability_queue
with (security_invoker = true)
as
select
  'CURRENT_CAPTURE_EXCEPTION'::text as item_source,
  e.id as source_record_id,
  e.source_message_id,
  null::uuid as existing_intake_id,
  e.provider_message_id,
  e.provider,
  e.receiver_channel_id,
  e.authorization_state as accountability_state,
  e.disposition as effective_disposition,
  e.assigned_team,
  e.next_action as effective_next_action,
  e.closure_reason,
  e.evidence,
  e.created_at as detected_at,
  e.closed_at as resolved_at,
  case
    when e.disposition = 'ACTIVE_PENDING' and e.authorization_state = 'RECEIVER_ID_MISSING' then 10
    when e.disposition = 'ACTIVE_PENDING' and e.authorization_state = 'CHANNEL_UNAUTHORIZED' then 20
    else 90
  end as priority_rank
from public.whatsapp_channel_intake_exceptions e

union all

select
  'HISTORICAL_RECONCILIATION'::text as item_source,
  h.id as source_record_id,
  h.source_message_id,
  h.existing_intake_id,
  h.provider_message_id,
  h.provider,
  h.receiver_channel_id,
  h.reconciliation_state as accountability_state,
  h.effective_disposition,
  h.assigned_team,
  h.effective_next_action,
  h.resolution_reason as closure_reason,
  h.evidence || jsonb_build_object(
    'resolution_id', h.resolution_id,
    'resolution_evidence', h.resolution_evidence,
    'resolved_by', h.resolved_by
  ) as evidence,
  h.reconciled_at as detected_at,
  h.resolved_at,
  case
    when h.effective_disposition <> 'ACTIVE_PENDING' then 90
    when h.reconciliation_state = 'AUTHORIZATION_CONFLICT' then 5
    when h.reconciliation_state = 'AUTHORIZED_CAPTURE_GAP' then 8
    when h.reconciliation_state = 'RECEIVER_ID_MISSING' then 10
    when h.reconciliation_state = 'CHANNEL_UNAUTHORIZED' then 20
    else 80
  end as priority_rank
from public.whatsapp_authorized_channel_history_accountability h;

revoke all on public.whatsapp_authorized_channel_accountability_queue from public, anon;
grant select on public.whatsapp_authorized_channel_accountability_queue to authenticated;

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
    q.source_message_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) to authenticated;

comment on view public.whatsapp_authorized_channel_accountability_queue is
  'Read-only Issue #232 queue unifying current authorized-channel capture exceptions and historical reconciliation evidence without mutating source truth.';
comment on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) is
  'Returns the deterministic authorized-channel accountability queue to authenticated inbox readers, pending-only by default, with bounded result size.';

commit;
