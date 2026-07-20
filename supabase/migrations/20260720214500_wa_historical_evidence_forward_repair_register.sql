-- Issue #232 read-only forward-repair diagnostics for historical accountability rows
-- whose durable evidence is insufficient for safe classification.

begin;

create or replace function public.get_whatsapp_historical_evidence_forward_repair_register(
  result_limit integer default 200
)
returns table (
  source_record_id uuid,
  source_message_id uuid,
  existing_intake_id uuid,
  provider_message_id text,
  receiver_channel_id text,
  accountability_state text,
  effective_disposition text,
  assigned_team text,
  effective_next_action text,
  detected_at timestamptz,
  repair_codes text[],
  evidence jsonb
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp historical evidence forward-repair diagnostics';
  end if;

  if result_limit is null or result_limit < 1 or result_limit > 1000 then
    raise exception 'result_limit must be between 1 and 1000';
  end if;

  return query
  with classified as (
    select
      q.*,
      array_remove(array[
        case when q.source_message_id is null then 'MISSING_SOURCE_MESSAGE_ID' end,
        case when nullif(btrim(q.provider_message_id), '') is null then 'MISSING_PROVIDER_MESSAGE_ID' end,
        case when nullif(btrim(q.receiver_channel_id), '') is null then 'MISSING_RECEIVER_CHANNEL_ID' end,
        case when q.accountability_state is null then 'MISSING_ACCOUNTABILITY_STATE' end,
        case
          when q.evidence is null
            or (q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by') = '{}'::jsonb
          then 'MISSING_EVIDENCE'
        end,
        case
          when q.existing_intake_id is null
            and q.effective_disposition = 'EXPLICITLY_CLOSED'
            and q.accountability_state = 'AUTHORIZED_ACCOUNTED'
          then 'GOVERNED_ACCOUNTED_WITHOUT_INTAKE_LINK'
        end
      ], null)::text[] as repair_codes
    from public.whatsapp_authorized_channel_accountability_queue q
    where q.item_source = 'HISTORICAL_RECONCILIATION'
  )
  select
    c.source_record_id,
    c.source_message_id,
    c.existing_intake_id,
    c.provider_message_id,
    c.receiver_channel_id,
    c.accountability_state,
    c.effective_disposition,
    c.assigned_team,
    c.effective_next_action,
    c.detected_at,
    c.repair_codes,
    c.evidence
  from classified c
  where cardinality(c.repair_codes) > 0
  order by
    cardinality(c.repair_codes) desc,
    c.detected_at asc,
    c.source_record_id asc
  limit result_limit;
end;
$$;

revoke all on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) from public;
revoke all on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) from anon;
grant execute on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) to authenticated;

comment on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) is
  'Read-only Issue #232 register of historical reconciliation rows lacking lineage or durable evidence required for safe classification and forward repair.';

commit;