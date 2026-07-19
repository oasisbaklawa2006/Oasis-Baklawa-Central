-- Forward repair: every same-target idempotent reuse must remain traceable on the
-- current intake, even when the contextual alias originated on an earlier intake.

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

    insert into public.whatsapp_business_intake_audit_log (
      intake_id, event_type, actor_user_id, event_data
    ) values (
      p_intake_id,
      case when existing_row.status = 'APPROVED' then 'CONTEXTUAL_ALIAS_REUSED' else 'CONTEXTUAL_ALIAS_LINKED_PENDING' end,
      actor_id,
      jsonb_build_object(
        'alias_id', existing_row.id,
        'originating_intake_id', existing_row.intake_id,
        'alias_status', existing_row.status,
        'alias_kind', existing_row.alias_kind,
        'context_type', existing_row.context_type,
        'context_key', existing_row.context_key,
        'normalized_alias', existing_row.normalized_alias,
        'target_entity_id', existing_row.target_entity_id,
        'current_intake_evidence', p_proposal_evidence
      )
    );

    if existing_row.status = 'PENDING' then
      update public.whatsapp_business_intakes
      set disposition = 'ACTIVE_PENDING',
          next_action = 'Track linked contextual alias review before any governed reuse.',
          sla_due_at = least(coalesce(sla_due_at, existing_row.due_at), existing_row.due_at),
          reconciliation_status = 'ACCOUNTED',
          reconciliation_issue = null
      where id = p_intake_id;
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

comment on function public.propose_whatsapp_contextual_alias(uuid, text, text, text, text, uuid, jsonb, uuid, text, timestamptz) is
  'Authorized contextual alias proposal with parent locking, contextual collision denial, and current-intake audit linkage for every same-target idempotent reuse.';
