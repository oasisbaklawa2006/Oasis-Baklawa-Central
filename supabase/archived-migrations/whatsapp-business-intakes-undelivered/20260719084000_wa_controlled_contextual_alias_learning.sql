-- Controlled contextual alias learning for B2B WhatsApp intake.
-- Approved mappings remain contextual evidence only; this migration never mutates
-- Customer Master, Product Master, orders, finance, dispatch, or inventory truth.

create table public.whatsapp_contextual_aliases (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  alias_kind text not null check (alias_kind in ('CUSTOMER', 'PRODUCT')),
  context_type text not null check (context_type in ('CONTACT', 'PHONE', 'CONVERSATION', 'COMMERCIAL_CUSTOMER')),
  context_key text not null check (nullif(btrim(context_key), '') is not null),
  alias_text text not null check (nullif(btrim(alias_text), '') is not null),
  normalized_alias text not null check (nullif(btrim(normalized_alias), '') is not null),
  target_entity_id uuid not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  proposal_evidence jsonb not null check (
    proposal_evidence <> '{}'::jsonb and proposal_evidence <> 'null'::jsonb
  ),
  proposed_by_user_id uuid not null references public.users(id) on delete restrict,
  assigned_user_id uuid null references public.users(id) on delete restrict,
  assigned_team text null,
  due_at timestamptz not null,
  decision_evidence jsonb null,
  rejection_reason text null,
  decided_by_user_id uuid null references public.users(id) on delete restrict,
  decided_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_contextual_alias_owner_required check (
    assigned_user_id is not null or nullif(btrim(assigned_team), '') is not null
  ),
  constraint whatsapp_contextual_alias_terminal_shape check (
    (status = 'PENDING' and decision_evidence is null and rejection_reason is null and decided_by_user_id is null and decided_at is null)
    or
    (status = 'APPROVED' and decision_evidence is not null and decision_evidence <> '{}'::jsonb and decision_evidence <> 'null'::jsonb and rejection_reason is null and decided_by_user_id is not null and decided_at is not null)
    or
    (status = 'REJECTED' and nullif(btrim(rejection_reason), '') is not null and decision_evidence is null and decided_by_user_id is not null and decided_at is not null)
  )
);

create unique index whatsapp_contextual_alias_one_live_mapping_idx
  on public.whatsapp_contextual_aliases(alias_kind, context_type, context_key, normalized_alias)
  where status in ('PENDING', 'APPROVED');

create index whatsapp_contextual_alias_queue_idx
  on public.whatsapp_contextual_aliases(status, due_at, assigned_team, assigned_user_id);

alter table public.whatsapp_contextual_aliases enable row level security;

create policy whatsapp_contextual_aliases_read
  on public.whatsapp_contextual_aliases
  for select
  to authenticated
  using (public.is_whatsapp_inbox_reader(auth.uid()));

revoke insert, update, delete, truncate on public.whatsapp_contextual_aliases from public;
revoke insert, update, delete, truncate on public.whatsapp_contextual_aliases from anon;
revoke insert, update, delete, truncate on public.whatsapp_contextual_aliases from authenticated;
grant select on public.whatsapp_contextual_aliases to authenticated;

create or replace function public.propose_whatsapp_contextual_alias(
  p_intake_id uuid,
  p_alias_kind text,
  p_context_type text,
  p_context_key text,
  p_alias_text text,
  p_target_entity_id uuid,
  p_proposal_evidence jsonb,
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
  intake_row public.whatsapp_business_intakes%rowtype;
  normalized_value text;
  effective_assigned_user_id uuid;
  effective_assigned_team text;
  existing_row public.whatsapp_contextual_aliases%rowtype;
  alias_id uuid;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to propose WhatsApp contextual aliases' using errcode = '42501';
  end if;

  if p_alias_kind not in ('CUSTOMER', 'PRODUCT') then
    raise exception 'unsupported contextual alias kind: %', p_alias_kind using errcode = '22023';
  end if;

  if p_context_type not in ('CONTACT', 'PHONE', 'CONVERSATION', 'COMMERCIAL_CUSTOMER') then
    raise exception 'unsupported contextual alias scope: %', p_context_type using errcode = '22023';
  end if;

  if nullif(btrim(p_context_key), '') is null or nullif(btrim(p_alias_text), '') is null then
    raise exception 'context key and alias text are required' using errcode = '23514';
  end if;

  if p_target_entity_id is null then
    raise exception 'target entity is required' using errcode = '23514';
  end if;

  if p_proposal_evidence is null or p_proposal_evidence = '{}'::jsonb or p_proposal_evidence = 'null'::jsonb then
    raise exception 'non-empty proposal evidence is required' using errcode = '23514';
  end if;

  if p_due_at is null then
    raise exception 'contextual alias review due time is required' using errcode = '23514';
  end if;

  select * into intake_row
  from public.whatsapp_business_intakes
  where id = p_intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if intake_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp business intake cannot propose alias learning' using errcode = '55000';
  end if;

  effective_assigned_user_id := coalesce(p_assigned_user_id, intake_row.assigned_user_id);
  effective_assigned_team := coalesce(nullif(btrim(p_assigned_team), ''), intake_row.assigned_team);

  if effective_assigned_user_id is null and effective_assigned_team is null then
    raise exception 'contextual alias review must retain an owner' using errcode = '23514';
  end if;

  normalized_value := lower(regexp_replace(btrim(p_alias_text), '\s+', ' ', 'g'));

  select * into existing_row
  from public.whatsapp_contextual_aliases
  where alias_kind = p_alias_kind
    and context_type = p_context_type
    and context_key = btrim(p_context_key)
    and normalized_alias = normalized_value
    and status in ('PENDING', 'APPROVED')
  for update;

  if found then
    if existing_row.target_entity_id <> p_target_entity_id then
      raise exception 'contextual alias already maps to a different target' using errcode = '23505';
    end if;
    return existing_row.id;
  end if;

  insert into public.whatsapp_contextual_aliases (
    intake_id, alias_kind, context_type, context_key, alias_text, normalized_alias,
    target_entity_id, proposal_evidence, proposed_by_user_id,
    assigned_user_id, assigned_team, due_at
  ) values (
    p_intake_id, p_alias_kind, p_context_type, btrim(p_context_key), btrim(p_alias_text), normalized_value,
    p_target_entity_id, p_proposal_evidence, actor_id,
    effective_assigned_user_id, effective_assigned_team, p_due_at
  ) returning id into alias_id;

  update public.whatsapp_business_intakes
  set disposition = 'ACTIVE_PENDING',
      next_action = 'Review contextual alias proposal before any governed reuse.',
      sla_due_at = least(coalesce(sla_due_at, p_due_at), p_due_at),
      reconciliation_status = 'ACCOUNTED',
      reconciliation_issue = null
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    p_intake_id,
    'CONTEXTUAL_ALIAS_PROPOSED',
    actor_id,
    jsonb_build_object(
      'alias_id', alias_id,
      'alias_kind', p_alias_kind,
      'context_type', p_context_type,
      'context_key', btrim(p_context_key),
      'normalized_alias', normalized_value,
      'target_entity_id', p_target_entity_id,
      'proposal_evidence', p_proposal_evidence,
      'due_at', p_due_at
    )
  );

  return alias_id;
exception
  when unique_violation then
    raise exception 'a live contextual alias proposal already exists' using errcode = '23505';
end;
$$;

create or replace function public.decide_whatsapp_contextual_alias(
  p_alias_id uuid,
  p_target_status text,
  p_decision_evidence jsonb default null,
  p_rejection_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  discovered_intake_id uuid;
  intake_row public.whatsapp_business_intakes%rowtype;
  alias_row public.whatsapp_contextual_aliases%rowtype;
  remaining_pending_count bigint;
  remaining_due_at timestamptz;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to decide WhatsApp contextual aliases' using errcode = '42501';
  end if;

  if p_target_status not in ('APPROVED', 'REJECTED') then
    raise exception 'unsupported contextual alias decision: %', p_target_status using errcode = '22023';
  end if;

  if p_target_status = 'APPROVED' and (
    p_decision_evidence is null or p_decision_evidence = '{}'::jsonb or p_decision_evidence = 'null'::jsonb
  ) then
    raise exception 'non-empty decision evidence is required to approve a contextual alias' using errcode = '23514';
  end if;

  if p_target_status = 'REJECTED' and nullif(btrim(p_rejection_reason), '') is null then
    raise exception 'rejection reason is required' using errcode = '23514';
  end if;

  select intake_id into discovered_intake_id
  from public.whatsapp_contextual_aliases
  where id = p_alias_id;

  if not found then
    raise exception 'WhatsApp contextual alias not found' using errcode = 'P0002';
  end if;

  select * into intake_row
  from public.whatsapp_business_intakes
  where id = discovered_intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'parent WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  select * into alias_row
  from public.whatsapp_contextual_aliases
  where id = p_alias_id and intake_id = discovered_intake_id
  for update;

  if not found then
    raise exception 'WhatsApp contextual alias not found after parent lock' using errcode = 'P0002';
  end if;

  if alias_row.status <> 'PENDING' then
    raise exception 'contextual alias is already terminal' using errcode = '55000';
  end if;

  update public.whatsapp_contextual_aliases
  set status = p_target_status,
      decision_evidence = case when p_target_status = 'APPROVED' then p_decision_evidence else null end,
      rejection_reason = case when p_target_status = 'REJECTED' then btrim(p_rejection_reason) else null end,
      decided_by_user_id = actor_id,
      decided_at = now(),
      updated_at = now()
  where id = p_alias_id;

  select count(*), min(due_at)
  into remaining_pending_count, remaining_due_at
  from public.whatsapp_contextual_aliases
  where intake_id = discovered_intake_id and status = 'PENDING';

  if intake_row.disposition = 'ACTIVE_PENDING' then
    update public.whatsapp_business_intakes
    set next_action = case
          when remaining_pending_count > 0 then 'Review every remaining contextual alias proposal before governed reuse.'
          else 'Continue governed intake resolution using only explicitly approved contextual aliases.'
        end,
        sla_due_at = remaining_due_at,
        reconciliation_status = 'ACCOUNTED',
        reconciliation_issue = null
    where id = discovered_intake_id;
  end if;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    discovered_intake_id,
    case when p_target_status = 'APPROVED' then 'CONTEXTUAL_ALIAS_APPROVED' else 'CONTEXTUAL_ALIAS_REJECTED' end,
    actor_id,
    jsonb_build_object(
      'alias_id', p_alias_id,
      'alias_kind', alias_row.alias_kind,
      'context_type', alias_row.context_type,
      'context_key', alias_row.context_key,
      'normalized_alias', alias_row.normalized_alias,
      'target_entity_id', alias_row.target_entity_id,
      'from_status', alias_row.status,
      'to_status', p_target_status,
      'decision_evidence', case when p_target_status = 'APPROVED' then p_decision_evidence else null end,
      'rejection_reason', case when p_target_status = 'REJECTED' then btrim(p_rejection_reason) else null end,
      'remaining_pending_alias_count', remaining_pending_count,
      'remaining_due_at', remaining_due_at
    )
  );

  return discovered_intake_id;
end;
$$;

revoke all on function public.propose_whatsapp_contextual_alias(uuid, text, text, text, text, uuid, jsonb, uuid, text, timestamptz) from public;
revoke all on function public.propose_whatsapp_contextual_alias(uuid, text, text, text, text, uuid, jsonb, uuid, text, timestamptz) from anon;
grant execute on function public.propose_whatsapp_contextual_alias(uuid, text, text, text, text, uuid, jsonb, uuid, text, timestamptz) to authenticated;

revoke all on function public.decide_whatsapp_contextual_alias(uuid, text, jsonb, text) from public;
revoke all on function public.decide_whatsapp_contextual_alias(uuid, text, jsonb, text) from anon;
grant execute on function public.decide_whatsapp_contextual_alias(uuid, text, jsonb, text) to authenticated;

comment on table public.whatsapp_contextual_aliases is
  'Context-scoped, human-governed alias proposals and decisions for B2B WhatsApp intake. Approval records evidence for later governed reuse but never mutates Customer Master or Product Master truth.';