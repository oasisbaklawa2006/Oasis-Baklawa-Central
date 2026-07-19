-- Read-only reconstruction of inbound WhatsApp messages that arrive as a
-- sequence of short fragments. This does not alter capture semantics or create
-- orders, drafts, finance, inventory, dispatch, customer, or product truth.

create or replace view public.whatsapp_inbound_message_packet_membership
with (security_invoker = true)
as
with ordered_messages as (
  select
    m.id as message_id,
    m.contact_id,
    m.provider_message_id,
    m.message_type,
    m.content,
    m.media_url,
    m.created_at,
    coalesce(m.contact_id::text, 'unresolved:' || m.id::text) as conversation_key,
    lag(m.created_at) over (
      partition by coalesce(m.contact_id::text, 'unresolved:' || m.id::text)
      order by m.created_at, m.id
    ) as previous_message_at
  from public.whatsapp_messages m
  where m.direction = 'inbound'
), sequenced_messages as (
  select
    *,
    sum(
      case
        when previous_message_at is null then 1
        when created_at - previous_message_at > interval '5 minutes' then 1
        else 0
      end
    ) over (
      partition by conversation_key
      order by created_at, message_id
      rows between unbounded preceding and current row
    ) as packet_sequence
  from ordered_messages
)
select
  message_id,
  contact_id,
  provider_message_id,
  message_type,
  content,
  media_url,
  created_at,
  first_value(message_id) over (
    partition by conversation_key, packet_sequence
    order by created_at, message_id
  ) as packet_anchor_message_id,
  packet_sequence
from sequenced_messages;

revoke all on public.whatsapp_inbound_message_packet_membership from public;
revoke all on public.whatsapp_inbound_message_packet_membership from anon;
grant select on public.whatsapp_inbound_message_packet_membership to authenticated;

create or replace view public.whatsapp_inbound_message_packets
with (security_invoker = true)
as
select
  p.packet_anchor_message_id as packet_id,
  p.contact_id,
  min(p.created_at) as packet_started_at,
  max(p.created_at) as packet_last_message_at,
  count(*)::bigint as message_count,
  array_agg(p.message_id order by p.created_at, p.message_id) as source_message_ids,
  array_agg(i.id order by p.created_at, p.message_id)
    filter (where i.id is not null) as intake_ids,
  string_agg(p.content, E'\n' order by p.created_at, p.message_id)
    filter (where p.content is not null) as reconstructed_text,
  bool_or(p.media_url is not null or p.message_type in ('image', 'document', 'audio', 'video')) as contains_media,
  bool_or(i.intake_kind in ('POTENTIAL_ORDER', 'ORDER', 'UNRESOLVED_RISK')) as contains_order_or_risk,
  bool_or(i.reconciliation_status = 'UNACCOUNTED') as contains_unaccounted_intake,
  count(i.id)::bigint as governed_intake_count,
  (count(i.id) = count(*)) as every_message_governed
from public.whatsapp_inbound_message_packet_membership p
left join public.whatsapp_business_intakes i
  on i.source_message_id = p.message_id
 and i.business_domain = 'B2B'
group by p.packet_anchor_message_id, p.contact_id;

revoke all on public.whatsapp_inbound_message_packets from public;
revoke all on public.whatsapp_inbound_message_packets from anon;
grant select on public.whatsapp_inbound_message_packets to authenticated;

create or replace function public.get_whatsapp_inbound_message_packet_exceptions()
returns table (
  packet_id uuid,
  contact_id uuid,
  packet_started_at timestamptz,
  packet_last_message_at timestamptz,
  message_count bigint,
  reconstructed_text text,
  contains_media boolean,
  contains_order_or_risk boolean,
  contains_unaccounted_intake boolean,
  governed_intake_count bigint,
  every_message_governed boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    packet_id,
    contact_id,
    packet_started_at,
    packet_last_message_at,
    message_count,
    reconstructed_text,
    contains_media,
    contains_order_or_risk,
    contains_unaccounted_intake,
    governed_intake_count,
    every_message_governed
  from public.whatsapp_inbound_message_packets
  where message_count > 1
    and (
      contains_order_or_risk
      or contains_unaccounted_intake
      or not every_message_governed
    )
  order by
    contains_unaccounted_intake desc,
    every_message_governed asc,
    packet_last_message_at asc,
    packet_id;
$$;

revoke all on function public.get_whatsapp_inbound_message_packet_exceptions() from public;
revoke all on function public.get_whatsapp_inbound_message_packet_exceptions() from anon;
grant execute on function public.get_whatsapp_inbound_message_packet_exceptions() to authenticated;

comment on view public.whatsapp_inbound_message_packet_membership is
  'Deterministic five-minute inbound-message packet membership for reconstructing fragmented WhatsApp business instructions without mutating source messages.';
comment on view public.whatsapp_inbound_message_packets is
  'Read-only packet summary that preserves ordered source-message and governed-intake lineage and flags silent-loss risk across fragmented inbound instructions.';