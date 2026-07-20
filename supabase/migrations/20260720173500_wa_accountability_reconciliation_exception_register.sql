-- Issue #232 uniquely traceable reconciliation-exception register.
-- Surfaces every queue row that prevents the zero-loss accountability invariant from proving clean.
-- Read-only: no source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(
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
  effective_disposition text,
  assigned_team text,
  effective_next_action text,
  closure_reason text,
  exception_codes text[],
  is_stale boolean,
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
    raise exception 'Not authorized to read WhatsApp accountability reconciliation exceptions';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  if result_limit is null or result_limit < 1 or result_limit > 1000 then
    raise exception 'result_limit must be between 1 and 1000';
  end if;

  return query
  with classified as (
    select
      q.*,
      q.accountability_state = 'AUTHORIZED_ACCOUNTED' as is_governed_accounted,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
      nullif(btrim(q.closure_reason), '') is null as missing_closure_reason
    from public.whatsapp_authorized_channel_accountability_queue q
  ), exceptions as (
    select
      c.*,
      array_remove(array[
        case
          when not c.is_governed_accounted
            and c.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')
          then 'ILLEGAL_DISPOSITION'
        end,
        case
          when not c.is_governed_accounted
            and c.effective_disposition = 'ACTIVE_PENDING'
            and c.missing_owner
          then 'MISSING_OWNER'
        end,
        case
          when not c.is_governed_accounted
            and c.effective_disposition = 'ACTIVE_PENDING'
            and c.missing_next_action
          then 'MISSING_NEXT_ACTION'
        end,
        case
          when not c.is_governed_accounted
            and c.effective_disposition = 'EXPLICITLY_CLOSED'
            and c.missing_closure_reason
          then 'MISSING_CLOSURE_REASON'
        end
      ]::text[], null) as exception_codes
    from classified c
  )
  select
    e.item_source,
    e.source_record_id,
    e.source_message_id,
    e.existing_intake_id,
    e.provider_message_id,
    e.provider,
    e.receiver_channel_id,
    e.accountability_state,
    e.effective_disposition,
    e.assigned_team,
    e.effective_next_action,
    e.closure_reason,
    e.exception_codes,
    e.detected_at <= statement_timestamp() - stale_after as is_stale,
    e.evidence,
    e.detected_at,
    e.resolved_at,
    e.priority_rank
  from exceptions e
  where cardinality(e.exception_codes) > 0
  order by
    e.priority_rank asc,
    e.detected_at asc,
    e.item_source asc,
    e.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(interval, integer) from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(interval, integer) from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(interval, integer) to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(interval, integer) is
  'Read-only Issue #232 register returning each unique queue row that has an illegal disposition, missing pending ownership/action, or a genuine explicit closure without recorded reason.';

commit;
