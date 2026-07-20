-- Read-only operator queue joining fragmented inbound WhatsApp packets to
-- governed intake accountability state. No source or system-of-record writes.

create or replace view public.whatsapp_inbound_packet_accountability_queue
with (security_invoker = true)
as
select
  p.packet_id,
  p.contact_id,
  p.packet_started_at,
  p.packet_last_message_at,
  p.message_count,
  p.source_message_ids,
  p.intake_ids,
  p.reconstructed_text,
  p.contains_media,
  p.contains_order_or_risk,
  p.contains_unaccounted_intake,
  p.governed_intake_count,
  p.every_message_governed,
  coalesce(
    array_agg(distinct l.accountability_state order by l.accountability_state)
      filter (where l.intake_id is not null),
    array[]::text[]
  ) as accountability_states,
  coalesce(
    array_agg(distinct l.accountable_user_id order by l.accountable_user_id)
      filter (where l.accountable_user_id is not null),
    array[]::uuid[]
  ) as accountable_user_ids,
  coalesce(
    array_agg(distinct l.accountable_team order by l.accountable_team)
      filter (where l.accountable_team is not null),
    array[]::text[]
  ) as accountable_teams,
  min(l.sla_due_at) filter (where l.disposition = 'ACTIVE_PENDING') as earliest_pending_sla_due_at,
  coalesce(bool_or(l.accountability_state <> 'ACCOUNTED'), false) as contains_accountability_exception,
  case
    when not p.every_message_governed then 'MESSAGE_CAPTURE_GAP'
    when p.contains_unaccounted_intake then 'UNACCOUNTED_INTAKE'
    when bool_or(l.accountability_state = 'OWNER_MISSING') then 'OWNER_MISSING'
    when bool_or(l.accountability_state = 'NEXT_ACTION_MISSING') then 'NEXT_ACTION_MISSING'
    when bool_or(l.accountability_state = 'SLA_MISSING') then 'SLA_MISSING'
    when bool_or(l.accountability_state = 'OVERDUE') then 'OVERDUE'
    when bool_or(l.accountability_state = 'CONVERSION_LINEAGE_MISSING') then 'CONVERSION_LINEAGE_MISSING'
    when bool_or(l.accountability_state = 'CLOSURE_EVIDENCE_MISSING') then 'CLOSURE_EVIDENCE_MISSING'
    when p.contains_order_or_risk then 'REVIEWABLE_ACCOUNTED_PACKET'
    else 'NO_ORDER_RISK_SIGNAL'
  end as packet_accountability_state
from public.whatsapp_inbound_message_packets p
left join lateral unnest(coalesce(p.intake_ids, array[]::uuid[])) as packet_intake(intake_id) on true
left join public.whatsapp_business_intake_accountability_ledger l
  on l.intake_id = packet_intake.intake_id
where p.message_count > 1
  and (
    p.contains_order_or_risk
    or p.contains_unaccounted_intake
    or not p.every_message_governed
  )
group by
  p.packet_id,
  p.contact_id,
  p.packet_started_at,
  p.packet_last_message_at,
  p.message_count,
  p.source_message_ids,
  p.intake_ids,
  p.reconstructed_text,
  p.contains_media,
  p.contains_order_or_risk,
  p.contains_unaccounted_intake,
  p.governed_intake_count,
  p.every_message_governed;

revoke all on public.whatsapp_inbound_packet_accountability_queue from public;
revoke all on public.whatsapp_inbound_packet_accountability_queue from anon;
grant select on public.whatsapp_inbound_packet_accountability_queue to authenticated;

create or replace function public.get_whatsapp_inbound_packet_accountability_queue()
returns setof public.whatsapp_inbound_packet_accountability_queue
language sql
stable
security invoker
set search_path = public
as $$
  select *
  from public.whatsapp_inbound_packet_accountability_queue
  order by
    case packet_accountability_state
      when 'MESSAGE_CAPTURE_GAP' then 0
      when 'UNACCOUNTED_INTAKE' then 1
      when 'OWNER_MISSING' then 2
      when 'NEXT_ACTION_MISSING' then 3
      when 'SLA_MISSING' then 4
      when 'OVERDUE' then 5
      when 'CONVERSION_LINEAGE_MISSING' then 6
      when 'CLOSURE_EVIDENCE_MISSING' then 7
      when 'REVIEWABLE_ACCOUNTED_PACKET' then 8
      else 9
    end,
    earliest_pending_sla_due_at nulls last,
    packet_last_message_at asc,
    packet_id;
$$;

revoke all on function public.get_whatsapp_inbound_packet_accountability_queue() from public;
revoke all on function public.get_whatsapp_inbound_packet_accountability_queue() from anon;
grant execute on function public.get_whatsapp_inbound_packet_accountability_queue() to authenticated;

comment on view public.whatsapp_inbound_packet_accountability_queue is
  'Read-only operator queue for fragmented inbound packets, preserving lineage while surfacing deterministic capture, ownership, next-action, SLA, conversion, and closure exceptions.';
