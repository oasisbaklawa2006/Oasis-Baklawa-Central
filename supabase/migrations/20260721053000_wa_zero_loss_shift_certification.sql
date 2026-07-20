-- Issue #232 read-only end-of-shift zero-loss certification.
-- Wraps the consolidated operations summary into an explicit certifiable/not-certifiable result.

begin;

create or replace function public.get_whatsapp_zero_loss_shift_certification(
  stale_after interval default interval '24 hours'
)
returns table (
  certified_at timestamptz,
  accountability_item_count bigint,
  active_pending_count bigint,
  explicit_closed_count bigint,
  pending_breach_count bigint,
  stale_pending_count bigint,
  transition_integrity_exception_count bigint,
  historical_repair_candidate_count bigint,
  unique_attention_item_count bigint,
  oldest_attention_detected_at timestamptz,
  unaccounted_potential_orders bigint,
  certification_status text,
  zero_loss_certified boolean
)
language plpgsql
stable
security invoker
set search_path = pg_catalog, public
as $$
begin
  if not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'Not authorized to read WhatsApp zero-loss shift certification';
  end if;

  if stale_after is null or stale_after <= interval '0 seconds' then
    raise exception 'stale_after must be greater than zero';
  end if;

  return query
  select
    statement_timestamp() as certified_at,
    s.accountability_item_count,
    s.active_pending_count,
    s.explicit_closed_count,
    s.pending_breach_count,
    s.stale_pending_count,
    s.transition_integrity_exception_count,
    s.historical_repair_candidate_count,
    s.unique_attention_item_count,
    s.oldest_attention_detected_at,
    s.unique_attention_item_count as unaccounted_potential_orders,
    case
      when s.zero_loss_operations_clear then 'CERTIFIED_ZERO_LOSS'
      else 'NOT_CERTIFIED_ATTENTION_REQUIRED'
    end as certification_status,
    s.zero_loss_operations_clear as zero_loss_certified
  from public.get_whatsapp_zero_loss_operations_summary(stale_after) s;
end;
$$;

revoke all on function public.get_whatsapp_zero_loss_shift_certification(interval) from public;
revoke all on function public.get_whatsapp_zero_loss_shift_certification(interval) from anon;
grant execute on function public.get_whatsapp_zero_loss_shift_certification(interval) to authenticated;

comment on function public.get_whatsapp_zero_loss_shift_certification(interval) is
  'Read-only Issue #232 end-of-shift certification. Certification succeeds only when the consolidated unique attention count, exposed as unaccounted_potential_orders, is zero.';

commit;
