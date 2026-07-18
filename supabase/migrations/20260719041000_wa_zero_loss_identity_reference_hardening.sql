-- Harden identity-triad hydration against syntactically valid but stale UUIDs.
-- A stale metadata reference must not make inbound intake insertion fail.

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
  submitter_contact_uuid uuid;
  original_contact_uuid uuid;
  customer_uuid uuid;
begin
  if submitter_contact_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    submitter_contact_uuid := submitter_contact_text::uuid;
  end if;

  if original_contact_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    original_contact_uuid := original_contact_text::uuid;
  end if;

  if customer_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    customer_uuid := customer_text::uuid;
  end if;

  if new.submitting_sender_contact_id is null
     and new.submitting_sender_user_id is null
     and submitter_contact_uuid is not null
     and exists (
       select 1 from public.whatsapp_contacts c where c.id = submitter_contact_uuid
     )
  then
    new.submitting_sender_contact_id := submitter_contact_uuid;
  end if;

  if new.original_communicator_contact_id is null
     and new.original_communicator_user_id is null
     and original_contact_uuid is not null
     and exists (
       select 1 from public.whatsapp_contacts c where c.id = original_contact_uuid
     )
  then
    new.original_communicator_contact_id := original_contact_uuid;
  end if;

  if new.commercial_customer_id is null
     and customer_uuid is not null
     and exists (
       select 1 from public.companies company where company.id = customer_uuid
     )
  then
    new.commercial_customer_id := customer_uuid;
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
       and nullif(btrim(new.identity_resolution_note), '') is not null
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

-- Complete the original safe backfill for commercial-customer metadata only
-- when the referenced company exists. Missing/stale references remain unresolved
-- and visible for operator resolution rather than aborting the migration.
with candidate_customers as (
  select
    i.id,
    case
      when i.metadata #>> '{identity_triad,commercial_customer_id}' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (i.metadata #>> '{identity_triad,commercial_customer_id}')::uuid
      else null
    end as customer_id
  from public.whatsapp_business_intakes i
  where i.commercial_customer_id is null
), valid_customers as (
  select candidate.id, candidate.customer_id
  from candidate_customers candidate
  join public.companies company on company.id = candidate.customer_id
)
update public.whatsapp_business_intakes intake
set
  commercial_customer_id = valid.customer_id,
  identity_resolution_status = case
    when (intake.submitting_sender_contact_id is not null or intake.submitting_sender_user_id is not null)
     and (intake.original_communicator_contact_id is not null or intake.original_communicator_user_id is not null)
     and nullif(btrim(intake.identity_resolution_note), '') is not null
    then 'RESOLVED'
    else 'PARTIAL'
  end
from valid_customers valid
where intake.id = valid.id;

comment on function public.hydrate_whatsapp_business_intake_identity_triad() is
  'Hydrates only existing contact/company references. Invalid or stale metadata remains unresolved and operator-visible instead of aborting inbound intake insertion.';