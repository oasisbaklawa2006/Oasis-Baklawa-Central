-- WhatsApp B2B zero-loss identity triad.
-- Canonical authority:
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
-- Authority merged to main by commit 68d53e2c1ff672e0b55166e727edf4f0cb6e1cf1 (PR #233).
-- Foundation sequence:
--   20260718173000_wa_zero_loss_intake_foundation.sql
--   20260718190000_wa_zero_loss_inbound_wiring.sql
--   20260718200000_wa_zero_loss_lifecycle_actions.sql
--
-- Scope: persist submitting sender, original communicator, and commercial
-- customer as distinct governed identities. This migration never creates or
-- mutates orders, order_items, sales_order_drafts, finance, dispatch, or inventory.

alter table public.whatsapp_business_intakes
  add column submitting_sender_contact_id uuid null references public.whatsapp_contacts(id) on delete restrict,
  add column submitting_sender_user_id uuid null references public.users(id) on delete restrict,
  add column original_communicator_contact_id uuid null references public.whatsapp_contacts(id) on delete restrict,
  add column original_communicator_user_id uuid null references public.users(id) on delete restrict,
  add column commercial_customer_id uuid null references public.companies(id) on delete restrict,
  add column identity_resolution_status text not null default 'UNRESOLVED' check (
    identity_resolution_status in ('UNRESOLVED', 'PARTIAL', 'RESOLVED')
  ),
  add column identity_resolution_note text null;

alter table public.whatsapp_business_intakes
  add constraint whatsapp_business_intakes_submitter_identity_shape check (
    not (
      submitting_sender_contact_id is not null and
      submitting_sender_user_id is not null
    )
  ),
  add constraint whatsapp_business_intakes_original_communicator_identity_shape check (
    not (
      original_communicator_contact_id is not null and
      original_communicator_user_id is not null
    )
  ),
  add constraint whatsapp_business_intakes_identity_resolution_match check (
    identity_resolution_status <> 'RESOLVED' or (
      (submitting_sender_contact_id is not null or submitting_sender_user_id is not null) and
      (original_communicator_contact_id is not null or original_communicator_user_id is not null) and
      commercial_customer_id is not null and
      nullif(btrim(identity_resolution_note), '') is not null
    )
  );

create index whatsapp_business_intakes_identity_resolution_idx
  on public.whatsapp_business_intakes(identity_resolution_status, commercial_customer_id, lifecycle_state);

create index whatsapp_business_intakes_submitting_sender_idx
  on public.whatsapp_business_intakes(submitting_sender_contact_id, submitting_sender_user_id);

create or replace function public.hydrate_whatsapp_business_intake_identity_triad()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  triad jsonb := coalesce(new.metadata -> 'identity_triad', '{}'::jsonb);
  submitter_contact_text text := triad ->> 'submitting_sender_contact_id';
  original_contact_text text := triad ->> 'original_communicator_contact_id';
  customer_text text := triad ->> 'commercial_customer_id';
begin
  if new.submitting_sender_contact_id is null
     and new.submitting_sender_user_id is null
     and submitter_contact_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    new.submitting_sender_contact_id := submitter_contact_text::uuid;
  end if;

  if new.original_communicator_contact_id is null
     and new.original_communicator_user_id is null
     and original_contact_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    new.original_communicator_contact_id := original_contact_text::uuid;
  end if;

  if new.commercial_customer_id is null
     and customer_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    new.commercial_customer_id := customer_text::uuid;
  end if;

  if new.identity_resolution_status = 'UNRESOLVED' and (
    new.submitting_sender_contact_id is not null or
    new.submitting_sender_user_id is not null or
    new.original_communicator_contact_id is not null or
    new.original_communicator_user_id is not null or
    new.commercial_customer_id is not null
  ) then
    new.identity_resolution_status := case
      when (new.submitting_sender_contact_id is not null or new.submitting_sender_user_id is not null)
       and (new.original_communicator_contact_id is not null or new.original_communicator_user_id is not null)
       and new.commercial_customer_id is not null
      then 'RESOLVED'
      else 'PARTIAL'
    end;
  end if;

  if new.identity_resolution_status = 'RESOLVED'
     and nullif(btrim(new.identity_resolution_note), '') is null
  then
    new.identity_resolution_status := 'PARTIAL';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_hydrate_whatsapp_business_intake_identity_triad
  on public.whatsapp_business_intakes;
create trigger trg_hydrate_whatsapp_business_intake_identity_triad
before insert on public.whatsapp_business_intakes
for each row execute function public.hydrate_whatsapp_business_intake_identity_triad();

update public.whatsapp_business_intakes
set
  submitting_sender_contact_id = case
    when metadata #>> '{identity_triad,submitting_sender_contact_id}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then (metadata #>> '{identity_triad,submitting_sender_contact_id}')::uuid
    else null
  end,
  original_communicator_contact_id = case
    when metadata #>> '{identity_triad,original_communicator_contact_id}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    then (metadata #>> '{identity_triad,original_communicator_contact_id}')::uuid
    else null
  end,
  identity_resolution_status = case
    when metadata #>> '{identity_triad,submitting_sender_contact_id}' is not null
      or metadata #>> '{identity_triad,original_communicator_contact_id}' is not null
    then 'PARTIAL'
    else 'UNRESOLVED'
  end
where
  submitting_sender_contact_id is null
  and submitting_sender_user_id is null
  and original_communicator_contact_id is null
  and original_communicator_user_id is null
  and commercial_customer_id is null;

create or replace function public.resolve_whatsapp_business_intake_identity(
  p_intake_id uuid,
  p_submitting_sender_contact_id uuid default null,
  p_submitting_sender_user_id uuid default null,
  p_original_communicator_contact_id uuid default null,
  p_original_communicator_user_id uuid default null,
  p_commercial_customer_id uuid default null,
  p_resolution_note text default null
)
returns table (
  intake_id uuid,
  identity_resolution_status text,
  submitting_sender_contact_id uuid,
  submitting_sender_user_id uuid,
  original_communicator_contact_id uuid,
  original_communicator_user_id uuid,
  commercial_customer_id uuid
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_row public.whatsapp_business_intakes%rowtype;
  actor_id uuid := auth.uid();
  effective_submitter_contact_id uuid;
  effective_submitter_user_id uuid;
  effective_original_contact_id uuid;
  effective_original_user_id uuid;
  effective_customer_id uuid;
  effective_status text;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'authenticated WhatsApp inbox reader required' using errcode = '42501';
  end if;

  if nullif(btrim(p_resolution_note), '') is null then
    raise exception 'identity resolution note is required' using errcode = '23514';
  end if;

  if p_submitting_sender_contact_id is not null and p_submitting_sender_user_id is not null then
    raise exception 'submitting sender must be either a contact or an internal user' using errcode = '23514';
  end if;

  if p_original_communicator_contact_id is not null and p_original_communicator_user_id is not null then
    raise exception 'original communicator must be either a contact or an internal user' using errcode = '23514';
  end if;

  select * into current_row
  from public.whatsapp_business_intakes
  where id = p_intake_id
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if current_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal intake identity cannot be changed' using errcode = '23514';
  end if;

  effective_submitter_contact_id := coalesce(p_submitting_sender_contact_id, current_row.submitting_sender_contact_id);
  effective_submitter_user_id := coalesce(p_submitting_sender_user_id, current_row.submitting_sender_user_id);
  effective_original_contact_id := coalesce(p_original_communicator_contact_id, current_row.original_communicator_contact_id);
  effective_original_user_id := coalesce(p_original_communicator_user_id, current_row.original_communicator_user_id);
  effective_customer_id := coalesce(p_commercial_customer_id, current_row.commercial_customer_id);

  if effective_submitter_contact_id is not null and effective_submitter_user_id is not null then
    raise exception 'resolved submitting sender is ambiguous' using errcode = '23514';
  end if;

  if effective_original_contact_id is not null and effective_original_user_id is not null then
    raise exception 'resolved original communicator is ambiguous' using errcode = '23514';
  end if;

  effective_status := case
    when (effective_submitter_contact_id is not null or effective_submitter_user_id is not null)
     and (effective_original_contact_id is not null or effective_original_user_id is not null)
     and effective_customer_id is not null
    then 'RESOLVED'
    when effective_submitter_contact_id is not null
      or effective_submitter_user_id is not null
      or effective_original_contact_id is not null
      or effective_original_user_id is not null
      or effective_customer_id is not null
    then 'PARTIAL'
    else 'UNRESOLVED'
  end;

  update public.whatsapp_business_intakes
  set
    submitting_sender_contact_id = effective_submitter_contact_id,
    submitting_sender_user_id = effective_submitter_user_id,
    original_communicator_contact_id = effective_original_contact_id,
    original_communicator_user_id = effective_original_user_id,
    commercial_customer_id = effective_customer_id,
    identity_resolution_status = effective_status,
    identity_resolution_note = btrim(p_resolution_note),
    lifecycle_state = case
      when effective_status <> 'RESOLVED' and lifecycle_state = 'RECEIVED' then 'AWAITING_CUSTOMER'
      else lifecycle_state
    end,
    next_action = case
      when effective_status <> 'RESOLVED'
      then 'Resolve submitting sender, original communicator, and commercial customer before order readiness.'
      else next_action
    end
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id,
    event_type,
    actor_user_id,
    event_data
  ) values (
    p_intake_id,
    'IDENTITY_TRIAD_RESOLVED',
    actor_id,
    jsonb_build_object(
      'previous_status', current_row.identity_resolution_status,
      'new_status', effective_status,
      'submitting_sender_contact_id', effective_submitter_contact_id,
      'submitting_sender_user_id', effective_submitter_user_id,
      'original_communicator_contact_id', effective_original_contact_id,
      'original_communicator_user_id', effective_original_user_id,
      'commercial_customer_id', effective_customer_id,
      'resolution_note', btrim(p_resolution_note)
    )
  );

  return query
  select
    i.id,
    i.identity_resolution_status,
    i.submitting_sender_contact_id,
    i.submitting_sender_user_id,
    i.original_communicator_contact_id,
    i.original_communicator_user_id,
    i.commercial_customer_id
  from public.whatsapp_business_intakes i
  where i.id = p_intake_id;
end;
$$;

revoke all on function public.resolve_whatsapp_business_intake_identity(uuid, uuid, uuid, uuid, uuid, uuid, text) from public;
revoke all on function public.resolve_whatsapp_business_intake_identity(uuid, uuid, uuid, uuid, uuid, uuid, text) from anon;
grant execute on function public.resolve_whatsapp_business_intake_identity(uuid, uuid, uuid, uuid, uuid, uuid, text) to authenticated;

comment on function public.resolve_whatsapp_business_intake_identity(uuid, uuid, uuid, uuid, uuid, uuid, text) is
  'Race-safe governed resolution of submitting sender, original communicator, and commercial customer. Never creates or mutates an order.';
