-- Follow-up hardening for 20260719040000_wa_zero_loss_identity_triad.sql.
-- An explicit contact value replaces an existing internal-user identity and an
-- explicit internal-user value replaces an existing contact identity. This
-- avoids an ambiguous coalesce result when an operator corrects identity type.

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

  if p_submitting_sender_contact_id is not null then
    effective_submitter_contact_id := p_submitting_sender_contact_id;
    effective_submitter_user_id := null;
  elsif p_submitting_sender_user_id is not null then
    effective_submitter_contact_id := null;
    effective_submitter_user_id := p_submitting_sender_user_id;
  else
    effective_submitter_contact_id := current_row.submitting_sender_contact_id;
    effective_submitter_user_id := current_row.submitting_sender_user_id;
  end if;

  if p_original_communicator_contact_id is not null then
    effective_original_contact_id := p_original_communicator_contact_id;
    effective_original_user_id := null;
  elsif p_original_communicator_user_id is not null then
    effective_original_contact_id := null;
    effective_original_user_id := p_original_communicator_user_id;
  else
    effective_original_contact_id := current_row.original_communicator_contact_id;
    effective_original_user_id := current_row.original_communicator_user_id;
  end if;

  effective_customer_id := coalesce(p_commercial_customer_id, current_row.commercial_customer_id);

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
      'previous_submitting_sender_contact_id', current_row.submitting_sender_contact_id,
      'previous_submitting_sender_user_id', current_row.submitting_sender_user_id,
      'submitting_sender_contact_id', effective_submitter_contact_id,
      'submitting_sender_user_id', effective_submitter_user_id,
      'previous_original_communicator_contact_id', current_row.original_communicator_contact_id,
      'previous_original_communicator_user_id', current_row.original_communicator_user_id,
      'original_communicator_contact_id', effective_original_contact_id,
      'original_communicator_user_id', effective_original_user_id,
      'previous_commercial_customer_id', current_row.commercial_customer_id,
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
