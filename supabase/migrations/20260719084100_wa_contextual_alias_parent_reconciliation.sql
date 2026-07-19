-- Forward repair for contextual-alias decisions: recompute the parent SLA across
-- every governed open-work ledger instead of clearing or narrowing it to aliases.

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
  remaining_alias_count bigint;
  remaining_governed_work_count bigint;
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

  select count(*) into remaining_alias_count
  from public.whatsapp_contextual_aliases
  where intake_id = discovered_intake_id and status = 'PENDING';

  select count(*), min(due_at)
  into remaining_governed_work_count, remaining_due_at
  from (
    select due_at
    from public.whatsapp_contextual_aliases
    where intake_id = discovered_intake_id and status = 'PENDING'
    union all
    select due_at
    from public.whatsapp_business_intake_intents
    where intake_id = discovered_intake_id and status = 'OPEN'
    union all
    select due_at
    from public.whatsapp_business_intake_clarifications
    where intake_id = discovered_intake_id and status = 'OPEN'
  ) governed_open_work;

  if intake_row.disposition = 'ACTIVE_PENDING' then
    update public.whatsapp_business_intakes
    set next_action = case
          when remaining_alias_count > 0 then 'Review every remaining contextual alias proposal before governed reuse.'
          when remaining_governed_work_count > 0 then 'Continue every remaining governed intake work item; none may be silently lost.'
          else 'Review completed governed work and continue intake resolution.'
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
      'remaining_pending_alias_count', remaining_alias_count,
      'remaining_governed_work_count', remaining_governed_work_count,
      'remaining_due_at', remaining_due_at
    )
  );

  return discovered_intake_id;
end;
$$;

comment on function public.decide_whatsapp_contextual_alias(uuid, text, jsonb, text) is
  'Authorized, row-locked contextual alias decision with evidence and cross-ledger parent reconciliation across aliases, routed intents, and clarifications.';
