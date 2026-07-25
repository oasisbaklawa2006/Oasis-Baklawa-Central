-- WhatsApp B2B zero-loss formal clarification workflow.
-- Canonical authority: docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
-- Scope: preserve unresolved questions as owned, auditable work. This migration
-- never creates or mutates orders, order_items, sales_order_drafts, finance,
-- dispatch, inventory, Customer Master, or Product Master truth.

create table public.whatsapp_business_intake_clarifications (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  clarification_type text not null check (
    clarification_type in ('CLASSIFICATION', 'CUSTOMER', 'PRODUCT', 'QUANTITY', 'OTHER')
  ),
  status text not null default 'OPEN' check (status in ('OPEN', 'ANSWERED', 'CANCELLED')),
  question text not null check (nullif(btrim(question), '') is not null),
  requested_by_user_id uuid not null references public.users(id) on delete restrict,
  assigned_user_id uuid null references public.users(id) on delete restrict,
  assigned_team text null,
  due_at timestamptz null,
  answer_text text null,
  answer_evidence jsonb null,
  answered_by_user_id uuid null references public.users(id) on delete restrict,
  answered_at timestamptz null,
  cancellation_reason text null,
  cancelled_by_user_id uuid null references public.users(id) on delete restrict,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_intake_clarification_owner_required check (
    assigned_user_id is not null or nullif(btrim(assigned_team), '') is not null
  ),
  constraint whatsapp_intake_clarification_terminal_shape check (
    (status = 'OPEN' and answer_text is null and answered_by_user_id is null and answered_at is null and cancellation_reason is null and cancelled_by_user_id is null and cancelled_at is null)
    or
    (status = 'ANSWERED' and nullif(btrim(answer_text), '') is not null and answer_evidence is not null and answered_by_user_id is not null and answered_at is not null and cancellation_reason is null and cancelled_by_user_id is null and cancelled_at is null)
    or
    (status = 'CANCELLED' and nullif(btrim(cancellation_reason), '') is not null and cancelled_by_user_id is not null and cancelled_at is not null and answer_text is null and answered_by_user_id is null and answered_at is null)
  )
);

create unique index whatsapp_intake_clarifications_one_open_type_idx
  on public.whatsapp_business_intake_clarifications(intake_id, clarification_type)
  where status = 'OPEN';

create index whatsapp_intake_clarifications_queue_idx
  on public.whatsapp_business_intake_clarifications(status, due_at, assigned_team, assigned_user_id);

alter table public.whatsapp_business_intake_clarifications enable row level security;

create policy whatsapp_intake_clarifications_read
  on public.whatsapp_business_intake_clarifications
  for select
  to authenticated
  using (public.is_whatsapp_inbox_reader(auth.uid()));

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
security invoker
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

create or replace function public.answer_whatsapp_business_intake_clarification(
  p_clarification_id uuid,
  p_answer_text text,
  p_answer_evidence jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  clarification_row public.whatsapp_business_intake_clarifications%rowtype;
  intake_row public.whatsapp_business_intakes%rowtype;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to answer WhatsApp intake clarifications' using errcode = '42501';
  end if;

  if nullif(btrim(p_answer_text), '') is null or p_answer_evidence is null then
    raise exception 'answer text and evidence are required' using errcode = '23514';
  end if;

  select * into clarification_row
  from public.whatsapp_business_intake_clarifications
  where id = p_clarification_id
  for update;

  if not found then
    raise exception 'WhatsApp intake clarification not found' using errcode = 'P0002';
  end if;

  if clarification_row.status <> 'OPEN' then
    raise exception 'clarification is already terminal' using errcode = '55000';
  end if;

  select * into intake_row
  from public.whatsapp_business_intakes
  where id = clarification_row.intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if intake_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp business intake cannot accept clarification answers' using errcode = '55000';
  end if;

  update public.whatsapp_business_intake_clarifications
  set status = 'ANSWERED',
      answer_text = btrim(p_answer_text),
      answer_evidence = p_answer_evidence,
      answered_by_user_id = actor_id,
      answered_at = now(),
      updated_at = now()
  where id = p_clarification_id;

  update public.whatsapp_business_intakes
  set disposition = 'ACTIVE_PENDING',
      next_action = 'Review clarification response and continue governed resolution.',
      reconciliation_status = 'ACCOUNTED',
      reconciliation_issue = null
  where id = clarification_row.intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    clarification_row.intake_id,
    'CLARIFICATION_ANSWERED',
    actor_id,
    jsonb_build_object(
      'clarification_id', p_clarification_id,
      'clarification_type', clarification_row.clarification_type,
      'question', clarification_row.question,
      'answer_text', btrim(p_answer_text),
      'answer_evidence', p_answer_evidence,
      'previous_next_action', intake_row.next_action
    )
  );

  return clarification_row.intake_id;
end;
$$;

revoke all on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) from public;
revoke all on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) from anon;
grant execute on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) to authenticated;

revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from public;
revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from anon;
grant execute on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) to authenticated;

comment on table public.whatsapp_business_intake_clarifications is
  'Owned, auditable clarification work for zero-loss B2B WhatsApp intake; unresolved questions remain visible until answered or explicitly cancelled by a later governed action.';
