-- Issue #232 read-only consolidated attention register.
-- Returns every item requiring operator attention once with all applicable reasons.

begin;

create or replace function public.get_whatsapp_zero_loss_attention_register(
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
  effective_disposition text,
  assigned_team text,
  effective_next_action text,
  closure_reason text,
  detected_at timestamptz,
  resolved_at timestamptz,
  priority_rank integer,
  attention_codes text[],
  evidence jsonb
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp zero-loss attention register';
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
      array_remove(array[
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and nullif(btrim(q.assigned_team), '') is null
          then 'MISSING_OWNER'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and nullif(btrim(q.effective_next_action), '') is null
          then 'MISSING_NEXT_ACTION'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and q.detected_at <= statement_timestamp() - stale_after
          then 'STALE_PENDING'
        end,
        case
          when q.effective_disposition is null
            or q.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')
          then 'ILLEGAL_DISPOSITION'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING' and q.resolved_at is not null
          then 'PENDING_WITH_RESOLVED_AT'
        end,
        case
          when q.effective_disposition = 'ACTIVE_PENDING'
            and nullif(btrim(q.closure_reason), '') is not null
          then 'PENDING_WITH_CLOSURE_REASON'
        end,
        case
          when q.effective_disposition = 'EXPLICITLY_CLOSED' and q.resolved_at is null
          then 'CLOSED_WITHOUT_RESOLVED_AT'
        end,
        case
          when q.effective_disposition = 'EXPLICITLY_CLOSED'
            and nullif(btrim(q.closure_reason), '') is null
          then 'CLOSED_WITHOUT_REASON'
        end,
        case
          when q.accountability_state = 'AUTHORIZED_ACCOUNTED'
            and q.effective_disposition is distinct from 'EXPLICITLY_CLOSED'
          then 'GOVERNED_ACCOUNTED_NOT_TERMINAL'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION' and q.source_message_id is null
          then 'MISSING_SOURCE_MESSAGE_ID'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION'
            and nullif(btrim(q.provider_message_id), '') is null
          then 'MISSING_PROVIDER_MESSAGE_ID'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION'
            and nullif(btrim(q.receiver_channel_id), '') is null
          then 'MISSING_RECEIVER_CHANNEL_ID'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION' and q.accountability_state is null
          then 'MISSING_ACCOUNTABILITY_STATE'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION'
            and (
              q.evidence is null
              or (q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by') = '{}'::jsonb
            )
          then 'MISSING_EVIDENCE'
        end,
        case
          when q.item_source = 'HISTORICAL_RECONCILIATION'
            and q.existing_intake_id is null
            and q.effective_disposition = 'EXPLICITLY_CLOSED'
            and q.accountability_state = 'AUTHORIZED_ACCOUNTED'
          then 'GOVERNED_ACCOUNTED_WITHOUT_INTAKE_LINK'
        end
      ], null)::text[] as attention_codes
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
    c.priority_rank,
    c.attention_codes,
    c.evidence
  from classified c
  where cardinality(c.attention_codes) > 0
  order by
    c.priority_rank asc,
    c.detected_at asc,
    cardinality(c.attention_codes) desc,
    c.item_source asc,
    c.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_zero_loss_attention_register(interval, integer) from public;
revoke all on function public.get_whatsapp_zero_loss_attention_register(interval, integer) from anon;
grant execute on function public.get_whatsapp_zero_loss_attention_register(interval, integer) to authenticated;

comment on function public.get_whatsapp_zero_loss_attention_register(interval, integer) is
  'Read-only Issue #232 consolidated attention register. Returns each item once with all pending, stale, transition-integrity, and historical forward-repair attention codes.';

commit;
