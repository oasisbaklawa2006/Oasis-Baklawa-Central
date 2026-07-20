-- Issue #232 read-only diagnostics for contradictory accountability state/disposition evidence.
-- No source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_accountability_transition_integrity_exceptions(
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
  effective_disposition text,
  assigned_team text,
  effective_next_action text,
  closure_reason text,
  detected_at timestamptz,
  resolved_at timestamptz,
  integrity_codes text[],
  evidence jsonb
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp accountability transition integrity exceptions';
  end if;

  if result_limit is null or result_limit < 1 or result_limit > 1000 then
    raise exception 'result_limit must be between 1 and 1000';
  end if;

  return query
  with classified as (
    select
      q.*,
      array_remove(array[
        case
          when q.effective_disposition is null
            or q.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')
          then 'ILLEGAL_DISPOSITION'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and q.resolved_at is not null
          then 'PENDING_WITH_RESOLVED_AT'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and nullif(btrim(q.closure_reason), '') is not null
          then 'PENDING_WITH_CLOSURE_REASON'
        end,
        case
          when q.effective_disposition = 'EXPLICITLY_CLOSED'
            and q.accountability_state is distinct from 'AUTHORIZED_ACCOUNTED'
            and q.resolved_at is null
          then 'CLOSED_WITHOUT_RESOLVED_AT'
        end,
        case
          when q.effective_disposition = 'EXPLICITLY_CLOSED'
            and q.accountability_state is distinct from 'AUTHORIZED_ACCOUNTED'
            and nullif(btrim(q.closure_reason), '') is null
          then 'CLOSED_WITHOUT_REASON'
        end,
        case
          when q.accountability_state = 'AUTHORIZED_ACCOUNTED'
            and q.effective_disposition is distinct from 'EXPLICITLY_CLOSED'
          then 'GOVERNED_ACCOUNTED_NOT_TERMINAL'
        end
      ], null)::text[] as integrity_codes
    from public.whatsapp_authorized_channel_accountability_queue q
  )
  select
    c.item_source,
    c.source_record_id,
    c.source_message_id,
    c.existing_intake_id,
    c.provider_message_id,
    c.receiver_channel_id,
    c.accountability_state,
    c.effective_disposition,
    c.assigned_team,
    c.effective_next_action,
    c.closure_reason,
    c.detected_at,
    c.resolved_at,
    c.integrity_codes,
    c.evidence
  from classified c
  where cardinality(c.integrity_codes) > 0
  order by
    c.detected_at asc,
    c.item_source asc,
    c.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) from public;
revoke all on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) from anon;
grant execute on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) to authenticated;

comment on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) is
  'Read-only Issue #232 diagnostics for contradictory disposition, resolution, closure-reason, and governed-accounted evidence. Returns each offending accountability item once with all applicable integrity codes.';

commit;
