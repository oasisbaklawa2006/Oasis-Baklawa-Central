-- WhatsApp B2B zero-loss multi-intent routing foundation.
-- Canonical authority: docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
-- Scope: preserve every independently actionable business intent as owned,
-- time-bound, auditable work. This migration never creates drafts or orders and
-- never writes finance, dispatch, inventory, Customer Master, or Product Master.

create table public.whatsapp_business_intake_intents (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  routing_key text not null check (nullif(btrim(routing_key), '') is not null),
  intent_type text not null check (
    intent_type in (
      'NEW_ORDER',
      'ORDER_MODIFICATION',
      'ORDER_CANCELLATION',
      'PRICE_ENQUIRY',
      'PAYMENT_INFORMATION',
      'DISPATCH_STATUS',
      'COMPLAINT',
      'CATALOGUE_REQUEST',
      'OTHER_BUSINESS'
    )
  ),
  status text not null default 'OPEN' check (status in ('OPEN', 'RESOLVED', 'EXPLICITLY_CLOSED')),
  summary text not null check (nullif(btrim(summary), '') is not null),
  source_evidence jsonb not null check (
    source_evidence <> '{}'::jsonb and source_evidence <> 'null'::jsonb
  ),
  assigned_user_id uuid null references public.users(id) on delete restrict,
  assigned_team text null,
  next_action text not null check (nullif(btrim(next_action), '') is not null),
  due_at timestamptz not null,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  resolved_by_user_id uuid null references public.users(id) on delete restrict,
  resolved_at timestamptz null,
  outcome_evidence jsonb null,
  closure_reason text null,
  closed_by_user_id uuid null references public.users(id) on delete restrict,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_business_intake_intent_owner_required check (
    assigned_user_id is not null or nullif(btrim(assigned_team), '') is not null
  ),
  constraint whatsapp_business_intake_intent_terminal_shape check (
    (
      status = 'OPEN'
      and resolved_by_user_id is null and resolved_at is null and outcome_evidence is null
      and closure_reason is null and closed_by_user_id is null and closed_at is null
    )
    or
    (
      status = 'RESOLVED'
      and resolved_by_user_id is not null and resolved_at is not null
      and outcome_evidence is not null and outcome_evidence <> '{}'::jsonb
      and outcome_evidence <> 'null'::jsonb
      and closure_reason is null and closed_by_user_id is null and closed_at is null
    )
    or
    (
      status = 'EXPLICITLY_CLOSED'
      and nullif(btrim(closure_reason), '') is not null
      and closed_by_user_id is not null and closed_at is not null
      and resolved_by_user_id is null and resolved_at is null and outcome_evidence is null
    )
  ),
  unique (intake_id, routing_key)
);

create index whatsapp_business_intake_intents_queue_idx
  on public.whatsapp_business_intake_intents(status, due_at, assigned_team, assigned_user_id);

alter table public.whatsapp_business_intake_intents enable row level security;

create policy whatsapp_business_intake_intents_read
  on public.whatsapp_business_intake_intents
  for select
  to authenticated
  using (public.is_whatsapp_inbox_reader(auth.uid()));

revoke insert, update, delete, truncate on public.whatsapp_business_intake_intents from public;
revoke insert, update, delete, truncate on public.whatsapp_business_intake_intents from anon;
revoke insert, update, delete, truncate on public.whatsapp_business_intake_intents from authenticated;
grant select on public.whatsapp_business_intake_intents to authenticated;

create or replace function public.route_whatsapp_business_intake_intent(
  p_intake_id uuid,
  p_routing_key text,
  p_intent_type text,
  p_summary text,
  p_source_evidence jsonb,
  p_next_action text,
  p_due_at timestamptz,
  p_assigned_user_id uuid default null,
  p_assigned_team text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  intake_row public.whatsapp_business_intakes%rowtype;
  existing_intent public.whatsapp_business_intake_intents%rowtype;
  routed_intent_id uuid;
  effective_assigned_user_id uuid;
  effective_assigned_team text;
  open_clarification_count bigint;
  open_clarification_due_at timestamptz;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to route WhatsApp business intents' using errcode = '42501';
  end if;

  if p_intent_type not in (
    'NEW_ORDER', 'ORDER_MODIFICATION', 'ORDER_CANCELLATION', 'PRICE_ENQUIRY',
    'PAYMENT_INFORMATION', 'DISPATCH_STATUS', 'COMPLAINT', 'CATALOGUE_REQUEST',
    'OTHER_BUSINESS'
  ) then
    raise exception 'unsupported WhatsApp business intent type: %', p_intent_type using errcode = '22023';
  end if;

  if nullif(btrim(p_routing_key), '') is null
    or nullif(btrim(p_summary), '') is null
    or nullif(btrim(p_next_action), '') is null
  then
    raise exception 'routing key, summary, and next action are required' using errcode = '23514';
  end if;

  if p_source_evidence is null
    or p_source_evidence = '{}'::jsonb
    or p_source_evidence = 'null'::jsonb
  then
    raise exception 'durable source evidence is required for every routed intent' using errcode = '23514';
  end if;

  if p_due_at is null then
    raise exception 'due time is required for every routed intent' using errcode = '23514';
  end if;

  select * into intake_row
  from public.whatsapp_business_intakes
  where id = p_intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if intake_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp business intake cannot receive routed intents' using errcode = '55000';
  end if;

  effective_assigned_user_id := coalesce(p_assigned_user_id, intake_row.assigned_user_id);
  effective_assigned_team := coalesce(nullif(btrim(p_assigned_team), ''), intake_row.assigned_team);

  if effective_assigned_user_id is null and effective_assigned_team is null then
    raise exception 'every routed intent must retain an owner' using errcode = '23514';
  end if;

  select * into existing_intent
  from public.whatsapp_business_intake_intents
  where intake_id = p_intake_id and routing_key = btrim(p_routing_key);

  if found then
    if existing_intent.intent_type <> p_intent_type
      or existing_intent.summary <> btrim(p_summary)
    then
      raise exception 'routing key already identifies a different business intent' using errcode = '23505';
    end if;
    return existing_intent.id;
  end if;

  insert into public.whatsapp_business_intake_intents (
    intake_id, routing_key, intent_type, summary, source_evidence,
    assigned_user_id, assigned_team, next_action, due_at, created_by_user_id
  ) values (
    p_intake_id, btrim(p_routing_key), p_intent_type, btrim(p_summary), p_source_evidence,
    effective_assigned_user_id, effective_assigned_team, btrim(p_next_action), p_due_at, actor_id
  )
  returning id into routed_intent_id;

  select count(*), min(due_at)
  into open_clarification_count, open_clarification_due_at
  from public.whatsapp_business_intake_clarifications
  where intake_id = p_intake_id and status = 'OPEN';

  update public.whatsapp_business_intakes
  set disposition = 'ACTIVE_PENDING',
      next_action = case
        when open_clarification_count > 0 then intake_row.next_action
        else 'Progress every routed business intent; none may remain unowned or silently terminal.'
      end,
      sla_due_at = least(intake_row.sla_due_at, p_due_at, open_clarification_due_at),
      reconciliation_status = 'ACCOUNTED',
      reconciliation_issue = null
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    p_intake_id,
    'BUSINESS_INTENT_ROUTED',
    actor_id,
    jsonb_build_object(
      'intent_id', routed_intent_id,
      'routing_key', btrim(p_routing_key),
      'intent_type', p_intent_type,
      'summary', btrim(p_summary),
      'source_evidence', p_source_evidence,
      'assigned_user_id', effective_assigned_user_id,
      'assigned_team', effective_assigned_team,
      'next_action', btrim(p_next_action),
      'due_at', p_due_at
    )
  );

  return routed_intent_id;
exception
  when unique_violation then
    select * into existing_intent
    from public.whatsapp_business_intake_intents
    where intake_id = p_intake_id and routing_key = btrim(p_routing_key);

    if found
      and existing_intent.intent_type = p_intent_type
      and existing_intent.summary = btrim(p_summary)
    then
      return existing_intent.id;
    end if;
    raise;
end;
$$;

revoke all on function public.route_whatsapp_business_intake_intent(uuid, text, text, text, jsonb, text, timestamptz, uuid, text) from public;
revoke all on function public.route_whatsapp_business_intake_intent(uuid, text, text, text, jsonb, text, timestamptz, uuid, text) from anon;
grant execute on function public.route_whatsapp_business_intake_intent(uuid, text, text, text, jsonb, text, timestamptz, uuid, text) to authenticated;

comment on table public.whatsapp_business_intake_intents is
  'Durable one-to-many routing ledger for independently actionable B2B WhatsApp business intents. Every intent remains owned, time-bound, auditable, and explicitly terminal.';
comment on function public.route_whatsapp_business_intake_intent(uuid, text, text, text, jsonb, text, timestamptz, uuid, text) is
  'Authorized, row-locked, idempotent routing of one independently actionable business intent. Does not create drafts, orders, or downstream operational truth.';
