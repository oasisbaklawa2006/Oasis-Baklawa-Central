-- Issue #232 authorized-channel historical reconciliation.
-- Runs only after the official B2B receiver allow-list is populated.
-- Historical whatsapp_messages and whatsapp_business_intakes remain immutable;
-- this migration adds append-only reconciliation evidence only.

create table public.whatsapp_authorized_channel_history_reconciliation (
  id uuid primary key default gen_random_uuid(),
  source_message_id uuid not null references public.whatsapp_messages(id) on delete restrict,
  existing_intake_id uuid null references public.whatsapp_business_intakes(id) on delete restrict,
  provider_message_id text null,
  provider text not null,
  receiver_channel_id text null,
  reconciliation_state text not null check (
    reconciliation_state in (
      'AUTHORIZED_ACCOUNTED',
      'AUTHORIZED_CAPTURE_GAP',
      'RECEIVER_ID_MISSING',
      'CHANNEL_UNAUTHORIZED',
      'AUTHORIZATION_CONFLICT'
    )
  ),
  disposition text not null default 'ACTIVE_PENDING' check (
    disposition in ('ACTIVE_PENDING','EXPLICITLY_CLOSED')
  ),
  assigned_team text not null default 'WHATSAPP_CHANNEL_GOVERNANCE',
  next_action text not null,
  evidence jsonb not null default '{}'::jsonb,
  reconciled_at timestamptz not null default now(),
  unique (source_message_id)
);

create index whatsapp_authorized_channel_history_reconciliation_active_idx
  on public.whatsapp_authorized_channel_history_reconciliation(
    disposition,
    reconciliation_state,
    reconciled_at
  );

create or replace function public.prevent_whatsapp_authorized_channel_history_reconciliation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  raise exception 'whatsapp_authorized_channel_history_reconciliation is append-only';
end;
$$;

create trigger trg_whatsapp_authorized_channel_history_reconciliation_no_mutation
before update or delete on public.whatsapp_authorized_channel_history_reconciliation
for each row execute function public.prevent_whatsapp_authorized_channel_history_reconciliation_mutation();

alter table public.whatsapp_authorized_channel_history_reconciliation enable row level security;

create policy whatsapp_authorized_channel_history_reconciliation_inbox_reader_select
on public.whatsapp_authorized_channel_history_reconciliation
for select to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

grant select on public.whatsapp_authorized_channel_history_reconciliation to authenticated;
revoke insert, update, delete, truncate
  on public.whatsapp_authorized_channel_history_reconciliation
  from public, anon, authenticated;

create or replace function public.reconcile_whatsapp_authorized_channel_history()
returns table (
  rows_inserted bigint,
  authorized_accounted bigint,
  authorized_capture_gap bigint,
  receiver_id_missing bigint,
  channel_unauthorized bigint,
  authorization_conflict bigint
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  inserted_count bigint;
begin
  if not exists (
    select 1
    from public.whatsapp_authorized_business_channels c
    where c.business_domain = 'B2B'
      and c.is_active
  ) then
    raise exception 'Populate and verify the active official B2B WhatsApp receiver allow-list before historical reconciliation';
  end if;

  insert into public.whatsapp_authorized_channel_history_reconciliation (
    source_message_id,
    existing_intake_id,
    provider_message_id,
    provider,
    receiver_channel_id,
    reconciliation_state,
    disposition,
    next_action,
    evidence
  )
  select
    wm.id,
    wbi.id,
    wm.provider_message_id,
    coalesce(nullif(btrim(wm.provider), ''), 'whatsapp'),
    receiver.receiver_channel_id,
    case
      when receiver.receiver_channel_id is null then 'RECEIVER_ID_MISSING'
      when channel.id is null and wbi.id is not null then 'AUTHORIZATION_CONFLICT'
      when channel.id is null then 'CHANNEL_UNAUTHORIZED'
      when wbi.id is null then 'AUTHORIZED_CAPTURE_GAP'
      else 'AUTHORIZED_ACCOUNTED'
    end,
    case
      when channel.id is not null and wbi.id is not null then 'EXPLICITLY_CLOSED'
      else 'ACTIVE_PENDING'
    end,
    case
      when receiver.receiver_channel_id is null then
        'Recover receiving-channel evidence and route this historical durable message without loss.'
      when channel.id is null and wbi.id is not null then
        'Review historical B2B intake created without current channel authorization evidence; do not rewrite historical truth.'
      when channel.id is null then
        'Route historical unauthorized-channel message to the correct governed business domain.'
      when wbi.id is null then
        'Repair the historical governed-intake capture gap through an explicitly approved remediation path.'
      else
        'Historical durable message and governed B2B intake are authorized and accounted.'
    end,
    jsonb_build_object(
      'reconciliation_source', 'authorized_channel_history_reconciliation',
      'message_created_at', wm.created_at,
      'message_type', wm.message_type,
      'contact_id', wm.contact_id,
      'existing_intake_id', wbi.id,
      'receiver_channel_id', receiver.receiver_channel_id,
      'authorized_channel_registry_id', channel.id,
      'historical_truth_mutated', false,
      'reconciled_at', now()
    )
  from public.whatsapp_messages wm
  left join public.whatsapp_business_intakes wbi
    on wbi.source_message_id = wm.id
  left join lateral (
    select public.extract_whatsapp_receiver_channel_id(dw.raw_payload) as receiver_channel_id
    from public.debug_webhooks dw
    where dw.wamid = wm.provider_message_id
      and dw.direction = 'inbound'
    order by dw.created_at desc
    limit 1
  ) receiver on true
  left join public.whatsapp_authorized_business_channels channel
    on channel.provider = coalesce(nullif(btrim(wm.provider), ''), 'whatsapp')
   and channel.receiver_channel_id = receiver.receiver_channel_id
   and channel.business_domain = 'B2B'
   and channel.is_active
  where wm.direction = 'inbound'
  on conflict (source_message_id) do nothing;

  get diagnostics inserted_count = row_count;

  return query
  select
    inserted_count,
    count(*) filter (where r.reconciliation_state = 'AUTHORIZED_ACCOUNTED')::bigint,
    count(*) filter (where r.reconciliation_state = 'AUTHORIZED_CAPTURE_GAP')::bigint,
    count(*) filter (where r.reconciliation_state = 'RECEIVER_ID_MISSING')::bigint,
    count(*) filter (where r.reconciliation_state = 'CHANNEL_UNAUTHORIZED')::bigint,
    count(*) filter (where r.reconciliation_state = 'AUTHORIZATION_CONFLICT')::bigint
  from public.whatsapp_authorized_channel_history_reconciliation r;
end;
$$;

revoke all on function public.reconcile_whatsapp_authorized_channel_history() from public;
revoke all on function public.reconcile_whatsapp_authorized_channel_history() from anon;
revoke all on function public.reconcile_whatsapp_authorized_channel_history() from authenticated;
grant execute on function public.reconcile_whatsapp_authorized_channel_history() to service_role;

comment on table public.whatsapp_authorized_channel_history_reconciliation is
  'Append-only Issue #232 evidence for historical durable-message authorization and capture reconciliation. Source messages and historical intakes are never rewritten.';
comment on function public.reconcile_whatsapp_authorized_channel_history() is
  'Idempotently classifies all durable inbound WhatsApp history against the populated official B2B receiver allow-list and exposes every gap or conflict as owned reconciliation work.';
