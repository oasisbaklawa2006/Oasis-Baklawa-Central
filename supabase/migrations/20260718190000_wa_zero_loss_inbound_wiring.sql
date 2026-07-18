-- WhatsApp B2B zero-loss inbound wiring.
-- Canonical authority:
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
--   docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md
-- Foundation migration:
--   20260718173000_wa_zero_loss_intake_foundation.sql
--
-- Scope: every durable inbound WhatsApp message written to whatsapp_messages
-- receives exactly one governed intake record. This migration does not write
-- orders, order_items, sales_order_drafts, finance, dispatch, or inventory.

create unique index whatsapp_business_intakes_source_message_unique
  on public.whatsapp_business_intakes(source_message_id)
  where source_message_id is not null;

create or replace function public.capture_whatsapp_business_intake_from_message()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  normalized_content text := lower(coalesce(new.content, ''));
  inferred_kind text;
  inferred_state text;
  inferred_next_action text;
  created_intake_id uuid;
begin
  if new.direction is distinct from 'inbound' then
    return new;
  end if;

  -- Noise and unsupported webhook events are filtered before whatsapp_messages.
  -- Any message that reaches this durable table must remain visible until classified.
  if
    normalized_content ~ '(order|need|send|want|box|boxes|carton|cartons|kg|pcs|pieces|rate|price|quote)'
    or normalized_content ~ '(sales order|purchase order|repeat order|same as before|previous order)'
  then
    inferred_kind := 'POTENTIAL_ORDER';
    inferred_state := 'RECEIVED';
    inferred_next_action := 'Review potential order and confirm customer, product, quantity, delivery, and commercial readiness.';
  elsif
    new.media_url is not null
    or coalesce(new.message_type, '') in ('image', 'document', 'audio', 'video')
  then
    inferred_kind := 'UNRESOLVED_RISK';
    inferred_state := 'AWAITING_CLASSIFICATION';
    inferred_next_action := 'Inspect inbound media and classify all business intents; preserve as unresolved risk until reviewed.';
  else
    inferred_kind := 'NON_ORDER_BUSINESS';
    inferred_state := 'AWAITING_CLASSIFICATION';
    inferred_next_action := 'Classify inbound WhatsApp message and route every identified business intent.';
  end if;

  insert into public.whatsapp_business_intakes (
    business_domain,
    source_message_id,
    provider_message_id,
    intake_kind,
    lifecycle_state,
    disposition,
    assigned_team,
    next_action,
    reconciliation_status,
    metadata
  ) values (
    'B2B',
    new.id,
    new.provider_message_id,
    inferred_kind,
    inferred_state,
    'ACTIVE_PENDING',
    'WHATSAPP_INTAKE',
    inferred_next_action,
    'ACCOUNTED',
    jsonb_build_object(
      'capture_source', 'whatsapp_messages_after_insert_trigger',
      'message_type', new.message_type,
      'contact_id', new.contact_id,
      'captured_at', now(),
      'identity_triad', jsonb_build_object(
        'submitting_sender_contact_id', new.contact_id,
        'submitting_sender_state', case when new.contact_id is null then 'MISSING' else 'CONFIRMED' end,
        'original_communicator_contact_id', new.contact_id,
        'original_communicator_state', case when new.contact_id is null then 'MISSING' else 'INFERRED_FROM_DIRECT_INBOUND' end,
        'commercial_customer_id', null,
        'commercial_customer_state', 'UNRESOLVED'
      )
    )
  )
  on conflict do nothing
  returning id into created_intake_id;

  if created_intake_id is not null then
    insert into public.whatsapp_business_intake_audit_log (
      intake_id,
      event_type,
      actor_user_id,
      event_data
    ) values (
      created_intake_id,
      'INBOUND_CAPTURED',
      null,
      jsonb_build_object(
        'source_message_id', new.id,
        'provider_message_id', new.provider_message_id,
        'intake_kind', inferred_kind,
        'lifecycle_state', inferred_state,
        'assigned_team', 'WHATSAPP_INTAKE',
        'identity_triad', jsonb_build_object(
          'submitting_sender_contact_id', new.contact_id,
          'submitting_sender_state', case when new.contact_id is null then 'MISSING' else 'CONFIRMED' end,
          'original_communicator_contact_id', new.contact_id,
          'original_communicator_state', case when new.contact_id is null then 'MISSING' else 'INFERRED_FROM_DIRECT_INBOUND' end,
          'commercial_customer_id', null,
          'commercial_customer_state', 'UNRESOLVED'
        )
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.capture_whatsapp_business_intake_from_message() from public;
revoke all on function public.capture_whatsapp_business_intake_from_message() from anon;
revoke all on function public.capture_whatsapp_business_intake_from_message() from authenticated;

drop trigger if exists trg_capture_whatsapp_business_intake on public.whatsapp_messages;
create trigger trg_capture_whatsapp_business_intake
after insert on public.whatsapp_messages
for each row
execute function public.capture_whatsapp_business_intake_from_message();

comment on function public.capture_whatsapp_business_intake_from_message() is
  'Captures every durable inbound WhatsApp message into the governed B2B zero-loss intake ledger. Never creates executable orders.';
