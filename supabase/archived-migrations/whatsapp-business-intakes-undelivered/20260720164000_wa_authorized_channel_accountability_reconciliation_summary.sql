-- Issue #232 read-only reconciliation summary for authorized-channel accountability items.
-- Equation: accountability items received = governed/accounted + active pending + explicitly closed.
-- The programme metric is zero only when the equation balances and every pending item is owned and actionable.

begin;

create or replace function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary()
returns table (
  accountability_items_received bigint,
  governed_accounted_count bigint,
  active_pending_count bigint,
  explicitly_closed_count bigint,
  equation_mismatch_count bigint,
  pending_without_owner_count bigint,
  pending_without_next_action_count bigint,
  unique_unaccounted_count bigint,
  closure_without_reason_count bigint,
  metric_is_zero boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read the WhatsApp accountability reconciliation summary';
  end if;

  return query
  with classified as (
    select
      q.effective_disposition,
      q.accountability_state = 'AUTHORIZED_ACCOUNTED' as is_governed_accounted,
      nullif(btrim(q.assigned_team), '') is null as missing_owner,
      nullif(btrim(q.effective_next_action), '') is null as missing_next_action,
      nullif(btrim(q.closure_reason), '') is null as missing_closure_reason
    from public.whatsapp_authorized_channel_accountability_queue q
  ), counts as (
    select
      count(*)::bigint as received,
      count(*) filter (where is_governed_accounted)::bigint as governed_accounted,
      count(*) filter (
        where effective_disposition = 'ACTIVE_PENDING'
          and not is_governed_accounted
      )::bigint as active_pending,
      count(*) filter (
        where effective_disposition = 'EXPLICITLY_CLOSED'
          and not is_governed_accounted
      )::bigint as explicitly_closed,
      count(*) filter (
        where effective_disposition = 'ACTIVE_PENDING'
          and not is_governed_accounted
          and missing_owner
      )::bigint as pending_without_owner,
      count(*) filter (
        where effective_disposition = 'ACTIVE_PENDING'
          and not is_governed_accounted
          and missing_next_action
      )::bigint as pending_without_next_action,
      count(*) filter (
        where effective_disposition = 'ACTIVE_PENDING'
          and not is_governed_accounted
          and (missing_owner or missing_next_action)
      )::bigint as unique_unaccounted,
      count(*) filter (
        where effective_disposition = 'EXPLICITLY_CLOSED'
          and not is_governed_accounted
          and missing_closure_reason
      )::bigint as closure_without_reason
    from classified
  )
  select
    c.received,
    c.governed_accounted,
    c.active_pending,
    c.explicitly_closed,
    (
      c.received
      - c.governed_accounted
      - c.active_pending
      - c.explicitly_closed
    )::bigint as equation_mismatch_count,
    c.pending_without_owner,
    c.pending_without_next_action,
    c.unique_unaccounted,
    c.closure_without_reason,
    (
      c.received = c.governed_accounted + c.active_pending + c.explicitly_closed
      and c.unique_unaccounted = 0
      and c.closure_without_reason = 0
    ) as metric_is_zero
  from counts c;
end;
$$;

revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() from public;
revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() from anon;
grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() to authenticated;

comment on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() is
  'Read-only Issue #232 reconciliation summary. Balances accountability items received against governed/accounted, active pending, and explicitly closed outcomes while reporting unique pending ownership/action breaches and genuine closures missing a reason.';

commit;
