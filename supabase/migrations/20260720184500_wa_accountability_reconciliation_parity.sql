-- Issue #232 read-only parity preflight between reconciliation summary metrics and exception classification.
-- Detects drift that could otherwise make aggregate zero-loss reporting disagree with row-level evidence.
-- No source or operational truth is mutated.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity()
returns table (
  summary_equation_mismatch_count bigint,
  classified_illegal_disposition_count bigint,
  equation_count_delta bigint,
  equation_counts_match boolean,
  summary_unique_unaccounted_count bigint,
  classified_unique_pending_breach_count bigint,
  pending_breach_count_delta bigint,
  pending_breach_counts_match boolean,
  summary_closure_without_reason_count bigint,
  classified_closure_reason_breach_count bigint,
  closure_reason_count_delta bigint,
  closure_reason_counts_match boolean,
  parity_is_zero boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp accountability reconciliation parity';
  end if;

  return query
  with summary as (
    select
      s.equation_mismatch_count,
      s.unique_unaccounted_count,
      s.closure_without_reason_count
    from public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() s
  ), classified as (
    select
      q.accountability_state = 'AUTHORIZED_ACCOUNTED' as is_governed_accounted,
      q.effective_disposition,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
      nullif(btrim(q.closure_reason), '') is null as missing_closure_reason
    from public.whatsapp_authorized_channel_accountability_queue q
  ), counts as (
    select
      count(*) filter (
        where not is_governed_accounted
          and (
            effective_disposition is null
            or effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')
          )
      )::bigint as illegal_disposition_count,
      count(*) filter (
        where not is_governed_accounted
          and effective_disposition = 'ACTIVE_PENDING'
          and (missing_owner or missing_next_action)
      )::bigint as unique_pending_breach_count,
      count(*) filter (
        where not is_governed_accounted
          and effective_disposition = 'EXPLICITLY_CLOSED'
          and missing_closure_reason
      )::bigint as closure_reason_breach_count
    from classified
  )
  select
    s.equation_mismatch_count,
    c.illegal_disposition_count,
    (s.equation_mismatch_count - c.illegal_disposition_count)::bigint,
    s.equation_mismatch_count = c.illegal_disposition_count,
    s.unique_unaccounted_count,
    c.unique_pending_breach_count,
    (s.unique_unaccounted_count - c.unique_pending_breach_count)::bigint,
    s.unique_unaccounted_count = c.unique_pending_breach_count,
    s.closure_without_reason_count,
    c.closure_reason_breach_count,
    (s.closure_without_reason_count - c.closure_reason_breach_count)::bigint,
    s.closure_without_reason_count = c.closure_reason_breach_count,
    (
      s.equation_mismatch_count = c.illegal_disposition_count
      and s.unique_unaccounted_count = c.unique_pending_breach_count
      and s.closure_without_reason_count = c.closure_reason_breach_count
    ) as parity_is_zero
  from summary s
  cross join counts c;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() is
  'Read-only Issue #232 parity preflight proving aggregate reconciliation counts agree with independently classified row-level accountability exceptions.';

commit;
