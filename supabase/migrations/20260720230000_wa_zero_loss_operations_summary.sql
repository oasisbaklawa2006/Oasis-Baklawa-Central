-- Issue #232 consolidated read-only zero-loss operations summary.
-- Combines pending accountability breaches, stale work, transition contradictions,
-- and historical forward-repair candidates without mutating operational truth.

begin;

create or replace function public.get_whatsapp_zero_loss_operations_summary(
  stale_after interval default interval '24 hours'
)
returns table (
  accountability_item_count bigint,
  active_pending_count bigint,
  explicit_closed_count bigint,
  pending_breach_count bigint,
  stale_pending_count bigint,
  transition_integrity_exception_count bigint,
  historical_repair_candidate_count bigint,
  unique_attention_item_count bigint,
  oldest_attention_detected_at timestamptz,
  zero_loss_operations_clear boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp zero-loss operations summary';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  return query
  with classified as (
    select
      q.item_source,
      q.source_record_id,
      q.detected_at,
      q.effective_disposition,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
      (
        q.effective_disposition is null
        or q.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')
        or (q.effective_disposition = 'ACTIVE_PENDING' and q.resolved_at is not null)
        or (q.effective_disposition = 'ACTIVE_PENDING' and nullif(btrim(q.closure_reason), '') is not null)
        or (q.effective_disposition = 'EXPLICITLY_CLOSED' and q.resolved_at is null)
        or (q.effective_disposition = 'EXPLICITLY_CLOSED' and nullif(btrim(q.closure_reason), '') is null)
        or (
          q.accountability_state = 'AUTHORIZED_ACCOUNTED'
          and q.effective_disposition is distinct from 'EXPLICITLY_CLOSED'
        )
      ) as has_transition_integrity_exception,
      (
        q.item_source = 'HISTORICAL_RECONCILIATION'
        and (
          q.source_message_id is null
          or nullif(btrim(q.provider_message_id), '') is null
          or nullif(btrim(q.receiver_channel_id), '') is null
          or q.accountability_state is null
          or q.evidence is null
          or (q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by') = '{}'::jsonb
          or (
            q.existing_intake_id is null
            and q.effective_disposition = 'EXPLICITLY_CLOSED'
            and q.accountability_state = 'AUTHORIZED_ACCOUNTED'
          )
        )
      ) as is_historical_repair_candidate
    from public.whatsapp_authorized_channel_accountability_queue q
  ), flagged as (
    select
      c.*,
      (
        c.effective_disposition = 'ACTIVE_PENDING'
        and (c.missing_owner or c.missing_next_action)
      ) as is_pending_breach,
      (
        c.effective_disposition = 'ACTIVE_PENDING'
        and c.detected_at <= statement_timestamp() - stale_after
      ) as is_stale_pending
    from classified c
  ), totals as (
    select
      count(*)::bigint as accountability_item_count,
      count(*) filter (where effective_disposition = 'ACTIVE_PENDING')::bigint as active_pending_count,
      count(*) filter (where effective_disposition = 'EXPLICITLY_CLOSED')::bigint as explicit_closed_count,
      count(*) filter (where is_pending_breach)::bigint as pending_breach_count,
      count(*) filter (where is_stale_pending)::bigint as stale_pending_count,
      count(*) filter (where has_transition_integrity_exception)::bigint as transition_integrity_exception_count,
      count(*) filter (where is_historical_repair_candidate)::bigint as historical_repair_candidate_count,
      count(*) filter (
        where is_pending_breach
          or is_stale_pending
          or has_transition_integrity_exception
          or is_historical_repair_candidate
      )::bigint as unique_attention_item_count,
      min(detected_at) filter (
        where is_pending_breach
          or is_stale_pending
          or has_transition_integrity_exception
          or is_historical_repair_candidate
      ) as oldest_attention_detected_at
    from flagged
  )
  select
    t.accountability_item_count,
    t.active_pending_count,
    t.explicit_closed_count,
    t.pending_breach_count,
    t.stale_pending_count,
    t.transition_integrity_exception_count,
    t.historical_repair_candidate_count,
    t.unique_attention_item_count,
    t.oldest_attention_detected_at,
    t.unique_attention_item_count = 0 as zero_loss_operations_clear
  from totals t;
end;
$$;

revoke all on function public.get_whatsapp_zero_loss_operations_summary(interval) from public;
revoke all on function public.get_whatsapp_zero_loss_operations_summary(interval) from anon;
grant execute on function public.get_whatsapp_zero_loss_operations_summary(interval) to authenticated;

comment on function public.get_whatsapp_zero_loss_operations_summary(interval) is
  'Read-only Issue #232 consolidated operations summary. Counts each attention item once across pending accountability breaches, stale pending work, transition contradictions, and historical evidence repair candidates.';

commit;
