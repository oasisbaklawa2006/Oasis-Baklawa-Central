-- Issue #232 authorized-channel intake boundary.
-- Canonical authority:
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
--   docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md
--
-- Goal: only messages received through an explicitly registered official B2B
-- WhatsApp channel may enter the B2B governed intake ledger. Messages whose
-- receiver identity is missing or unauthorized remain durably visible in a
-- separate owned exception queue; they are never silently discarded.

create table public.whatsapp_authorized_business_channels (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  receiver_channel_id text not null,
  business_domain text not null check (business_domain = 'B2B'),
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, receiver_channel_id, business_domain)
);

create table public.whatsapp_channel_intake_exceptions (
  id uuid primary key default gen_random_uuid(),
  source_message_id uuid not null references public.whatsapp_messages(id) on delete restrict,
  provider_message_id text null,
  provider text not null,
  receiver_channel_id text null,
  authorization_state text not null check (
    authorization_state in ('RECEIVER_ID_MISSING','CHANNEL_UNAUTHORIZED')
  ),
  disposition text not null default 'ACTIVE_PENDING' check (
    disposition in ('ACTIVE_PENDING','EXPLICITLY_CLOSED')
  ),
  assigned_team text not null default 'WHATSAPP_CHANNEL_GOVERNANCE',
  next_action text not null,
  closure_reason text null,
  closed_by_user_id uuid null references public.users(id) on delete restrict,
  closed_at timestamptz null,
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_message_id),
  constraint whatsapp_channel_intake_exceptions_closed_fields check (
    disposition <> 'EXPLICITLY_CLOSED' or (
      nullif(btrim(closure_reason), '') is not null and
      closed_by_user_id is not null and
      closed_at is not null
    )
  )
);

create index whatsapp_channel_intake_exceptions_active_idx
  on public.whatsapp_channel_intake_exceptions(disposition, authorization_state, created_at);

create or replace function public.extract_whatsapp_receiver_channel_id(payload jsonb)
returns text
language sql
immutable
security invoker
set search_path = pg_catalog, public
as $$
  select nullif(btrim(coalesce(
    payload #>> '{entry,0,changes,0,value,metadata,phone_number_id}',
    payload #>> '{value,metadata,phone_number_id}',
    payload #>> '{metadata,phone_number_id}',
    payload ->> 'phone_number_id'
  )), '');
$$;

create or replace function public.set_whatsapp_channel_governance_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_authorized_business_channels_updated_at
  on public.whatsapp_authorized_business_channels;
create trigger trg_whatsapp_authorized_business_channels_updated_at
before update on public.whatsapp_authorized_business_channels
for each row execute function public.set_whatsapp_channel_governance_updated_at();

drop trigger if exists trg_whatsapp_channel_intake_exceptions_updated_at
  on public.whatsapp_channel_intake_exceptions;
create trigger trg_whatsapp_channel_intake_exceptions_updated_at
before update on public.whatsapp_channel_intake_exceptions
for each row execute function public.set_whatsapp_channel_governance_updated_at();

alter table public.whatsapp_authorized_business_channels enable row level security;
alter table public.whatsapp_channel_intake_exceptions enable row level security;

create policy whatsapp_authorized_business_channels_inbox_reader_select
on public.whatsapp_authorized_business_channels
for select to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

create policy whatsapp_channel_intake_exceptions_inbox_reader_select
on public.whatsapp_channel_intake_exceptions
for select to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

grant select on public.whatsapp_authorized_business_channels to authenticated;
grant select on public.whatsapp_channel_intake_exceptions to authenticated;

revoke insert, update, delete, truncate on public.whatsapp_authorized_business_channels
  from public, anon, authenticated;
revoke insert, update, delete, truncate on public.whatsapp_channel_intake_exceptions
  from public, anon, authenticated;

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
  receiver_channel_id text;
  channel_is_authorized boolean := false;
begin
  if new.direction is distinct from 'inbound' then
    return new;
  end if;

  select public.extract_whatsapp_receiver_channel_id(dw.raw_payload)
  into receiver_channel_id
  from public.debug_webhooks dw
  where dw.wamid = new.provider_message_id
    and dw.direction = 'inbound'
  order by dw.created_at desc
  limit 1;

  if receiver_channel_id is not null then
    select exists (
      select 1
      from public.whatsapp_authorized_business_channels c
      where c.provider = coalesce(nullif(btrim(new.provider), ''), 'whatsapp')
        and c.receiver_channel_id = receiver_channel_id
        and c.business_domain = 'B2B'
        and c.is_active
    ) into channel_is_authorized;
  end if;

  if not channel_is_authorized then
    insert into public.whatsapp_channel_intake_exceptions (
      source_message_id,
      provider_message_id,
      provider,
      receiver_channel_id,
      authorization_state,
      next_action,
      evidence
    ) values (
      new.id,
      new.provider_message_id,
      coalesce(nullif(btrim(new.provider), ''), 'whatsapp'),
      receiver_channel_id,
      case
        when receiver_channel_id is null then 'RECEIVER_ID_MISSING'
        else 'CHANNEL_UNAUTHORIZED'
      end,
      case
        when receiver_channel_id is null then
          'Verify receiving WhatsApp channel identity and route this durable message without loss.'
        else
          'Review unauthorized-channel message and route it to the correct governed business domain.'
      end,
      jsonb_build_object(
        'capture_source', 'whatsapp_messages_after_insert_trigger',
        'message_type', new.message_type,
        'contact_id', new.contact_id,
        'captured_at', now()
      )
    )
    on conflict (source_message_id) do nothing;

    return new;
  end if;

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
      'authorized_receiver_channel_id', receiver_channel_id,
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
        'authorized_receiver_channel_id', receiver_channel_id,
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

comment on table public.whatsapp_authorized_business_channels is
  'Explicit allow-list of official business receiver identities. Only active B2B rows authorize B2B intake creation.';
comment on table public.whatsapp_channel_intake_exceptions is
  'Zero-loss fail-closed queue for durable inbound messages whose receiving channel is missing or unauthorized.';
comment on function public.capture_whatsapp_business_intake_from_message() is
  'Routes durable inbound messages by verified receiving channel. Authorized B2B messages enter the B2B ledger; all others remain visible in the channel-governance exception queue.';
