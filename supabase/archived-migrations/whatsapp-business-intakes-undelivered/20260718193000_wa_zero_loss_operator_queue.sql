-- WhatsApp B2B zero-loss operator queue.
-- Canonical authority:
--   branch: docs/whatsapp-intent-zero-loss-governance
--   commit: d8000bad8bed157ed8f44a02a59d4677ca32c1b8
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
--   docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md
-- Foundation migrations:
--   20260718173000_wa_zero_loss_intake_foundation.sql
--   20260718190000_wa_zero_loss_inbound_wiring.sql
--
-- Scope: expose a read-only, RLS-preserving operator queue over governed intake
-- records and their durable source messages. This migration adds no lifecycle
-- writes and never creates executable orders.

-- Preserve source evidence for governed intakes even before packet stitching.
-- Access remains restricted to authenticated inbox readers and only to messages
-- already referenced by the governed zero-loss intake ledger.
drop policy if exists whatsapp_messages_governed_intake_reader_select
  on public.whatsapp_messages;
create policy whatsapp_messages_governed_intake_reader_select
  on public.whatsapp_messages
  for select
  to authenticated
  using (
    public.is_whatsapp_inbox_reader(auth.uid())
    and exists (
      select 1
      from public.whatsapp_business_intakes i
      where i.source_message_id = whatsapp_messages.id
        and i.business_domain = 'B2B'
    )
  );

create or replace view public.whatsapp_business_intake_operator_queue
with (security_invoker = true)
as
select
  i.id as intake_id,
  i.business_domain,
  i.intake_kind,
  i.lifecycle_state,
  i.disposition,
  i.assigned_user_id,
  i.assigned_team,
  i.escalation_owner_user_id,
  i.next_action,
  i.sla_due_at,
  i.reconciliation_status,
  i.reconciliation_issue,
  i.source_message_id,
  i.provider_message_id,
  i.sales_order_draft_id,
  i.sales_order_id,
  i.closure_reason,
  i.closed_by_user_id,
  i.closed_at,
  i.metadata,
  i.created_at as intake_created_at,
  i.updated_at as intake_updated_at,
  m.contact_id,
  m.direction as message_direction,
  m.message_type,
  m.content as message_content,
  m.media_url,
  m.status as message_status,
  m.message_timestamp,
  extract(epoch from (now() - i.created_at))::bigint as age_seconds,
  case
    when i.sla_due_at is null then false
    else i.sla_due_at < now()
  end as is_overdue
from public.whatsapp_business_intakes i
left join public.whatsapp_messages m
  on m.id = i.source_message_id
where i.business_domain = 'B2B';

revoke all on public.whatsapp_business_intake_operator_queue from public;
revoke all on public.whatsapp_business_intake_operator_queue from anon;
grant select on public.whatsapp_business_intake_operator_queue to authenticated;

comment on view public.whatsapp_business_intake_operator_queue is
  'Read-only RLS-preserving B2B WhatsApp intake queue for operators. Shows governed lifecycle state, source evidence, ownership, next action, SLA age, and reconciliation status.';