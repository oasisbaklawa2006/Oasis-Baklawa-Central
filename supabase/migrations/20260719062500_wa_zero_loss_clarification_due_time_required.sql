-- Require every formal clarification to remain time-bound and visible in the operator queue.
-- This hardening follows the initial clarification workflow migrations in the same PR.

alter table public.whatsapp_business_intake_clarifications
  alter column due_at set not null;

create or replace function public.create_whatsapp_business_intake_clarification(
  p_intake_id uuid,
  p_clarification_type text,
  p_question text,
  p_assigned_user_id uuid default null,
  p_assigned_team text default null,
  p_due_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  current_row public.whatsapp_business_intakes%rowtype;
  clarification_id uuid;
  target_state text;
  effective_assigned_user_id uuid;
  effective_assigned_team text;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to create WhatsApp intake clarifications' using errcode = '42501';
  end if;

  if p_clarification_type not in ('CLASSIFICATION', 'CUSTOMER', 'PRODUCT', 'QUANTITY', 'OTHER') then
    raise exception 'unsupported clarification type: %', p_clarification_type using errcode = '22023';
  end if;

  if nullif(btrim(p_question), '') is null then
    raise exception 'clarification question is required' using errcode = '23514';
  end if;

  if p_due_at is null then
    raise exception 'clarification due time is required' using errcode = '23514';
  end if;

  select * into current_row
  from public.whatsapp_business_intakes
  where id = p_intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if current_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp business intake cannot receive clarification work' using errcode = '55000';
  end if;

  effective_assigned_user_id := coalesce(p_assigned_user_id, current_row.assigned_user_id);
  effective_assigned_team := coalesce(nullif(btrim(p_assigned_team), ''), current_row.assigned_team);

  if effective_assigned_user_id is null and effective_assigned_team is null then
    raise exception 'clarification work must retain an owner' using errcode = '23514';
  end if;

  target_state := case p_clarification_type
    when 'CLASSIFICATION' then 'AWAITING_CLASSIFICATION'
    when 'CUSTOMER' then 'AWAITING_CUSTOMER'
    when 'PRODUCT' then 'AWAITING_PRODUCT'
    when 'QUANTITY' then 'AWAITING_QUANTITY'
    else 'AWAITING_OTHER_CLARIFICATION'
  end;

  insert into public.whatsapp_business_intake_clarifications (
    intake_id, clarification_type, question, requested_by_user_id,
    assigned_user_id, assigned_team, due_at
  ) values (
    p_intake_id, p_clarification_type, btrim(p_question), actor_id,
    effective_assigned_user_id, effective_assigned_team, p_due_at
  ) returning id into clarification_id;

  update public.whatsapp_business_intakes
  set lifecycle_state = target_state,
      disposition = 'ACTIVE_PENDING',
      assigned_user_id = effective_assigned_user_id,
      assigned_team = effective_assigned_team,
      next_action = 'Obtain clarification: ' || btrim(p_question),
      sla_due_at = p_due_at,
      reconciliation_status = 'ACCOUNTED',
      reconciliation_issue = null
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    p_intake_id,
    'CLARIFICATION_REQUESTED',
    actor_id,
    jsonb_build_object(
      'clarification_id', clarification_id,
      'clarification_type', p_clarification_type,
      'question', btrim(p_question),
      'assigned_user_id', effective_assigned_user_id,
      'assigned_team', effective_assigned_team,
      'due_at', p_due_at,
      'previous_lifecycle_state', current_row.lifecycle_state,
      'previous_next_action', current_row.next_action
    )
  );

  return clarification_id;
exception
  when unique_violation then
    raise exception 'an open clarification of this type already exists for the intake' using errcode = '23505';
end;
$$;

revoke all on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) from public;
revoke all on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) from anon;
grant execute on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) to authenticated;

comment on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) is
  'Creates authorized, owned, row-locked, time-bound clarification work for an active B2B WhatsApp intake.';
