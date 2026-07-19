-- Governed terminal lifecycle for routed B2B WhatsApp business intents.
-- Scope: resolve or explicitly close routed work with immutable evidence while
-- preserving parent reconciliation. Never creates drafts, orders, or downstream truth.

create or replace function public.transition_whatsapp_business_intake_intent(
  p_intent_id uuid,
  p_target_status text,
  p_outcome_evidence jsonb default null,
  p_closure_reason text default null
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
  intent_row public.whatsapp_business_intake_intents%rowtype;
  remaining_open_count bigint;
  remaining_due_at timestamptz;
  open_clarification_count bigint;
  open_clarification_due_at timestamptz;
  combined_open_due_at timestamptz;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to transition routed WhatsApp business intents' using errcode = '42501';
  end if;

  if p_target_status is null or p_target_status not in ('RESOLVED', 'EXPLICITLY_CLOSED') then
    raise exception 'unsupported routed intent terminal status: %', p_target_status using errcode = '22023';
  end if;

  if p_target_status = 'RESOLVED' and (
    p_outcome_evidence is null
    or p_outcome_evidence = '{}'::jsonb
    or p_outcome_evidence = 'null'::jsonb
  ) then
    raise exception 'non-empty outcome evidence is required to resolve a routed intent' using errcode = '23514';
  end if;

  if p_target_status = 'EXPLICITLY_CLOSED'
    and nullif(btrim(p_closure_reason), '') is null
  then
    raise exception 'closure reason is required to explicitly close a routed intent' using errcode = '23514';
  end if;

  select intake_id into discovered_intake_id
  from public.whatsapp_business_intake_intents
  where id = p_intent_id;

  if not found then
    raise exception 'routed WhatsApp business intent not found' using errcode = 'P0002';
  end if;

  -- Preserve the same parent-before-child lock order used by routing.
  select * into intake_row
  from public.whatsapp_business_intakes
  where id = discovered_intake_id and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'parent WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  select * into intent_row
  from public.whatsapp_business_intake_intents
  where id = p_intent_id and intake_id = discovered_intake_id
  for update;

  if not found then
    raise exception 'routed WhatsApp business intent not found after parent lock' using errcode = 'P0002';
  end if;

  if intent_row.status <> 'OPEN' then
    raise exception 'routed WhatsApp business intent is already terminal' using errcode = '55000';
  end if;

  update public.whatsapp_business_intake_intents
  set status = p_target_status,
      resolved_by_user_id = case when p_target_status = 'RESOLVED' then actor_id else null end,
      resolved_at = case when p_target_status = 'RESOLVED' then now() else null end,
      outcome_evidence = case when p_target_status = 'RESOLVED' then p_outcome_evidence else null end,
      closure_reason = case when p_target_status = 'EXPLICITLY_CLOSED' then btrim(p_closure_reason) else null end,
      closed_by_user_id = case when p_target_status = 'EXPLICITLY_CLOSED' then actor_id else null end,
      closed_at = case when p_target_status = 'EXPLICITLY_CLOSED' then now() else null end,
      updated_at = now()
  where id = p_intent_id;

  select count(*), min(due_at)
  into remaining_open_count, remaining_due_at
  from public.whatsapp_business_intake_intents
  where intake_id = discovered_intake_id and status = 'OPEN';

  select count(*), min(due_at)
  into open_clarification_count, open_clarification_due_at
  from public.whatsapp_business_intake_clarifications
  where intake_id = discovered_intake_id and status = 'OPEN';

  combined_open_due_at := least(remaining_due_at, open_clarification_due_at);

  if intake_row.disposition = 'ACTIVE_PENDING' then
    update public.whatsapp_business_intakes
    set next_action = case
          when open_clarification_count > 0 then intake_row.next_action
          when remaining_open_count > 0
            then 'Progress every remaining routed business intent; none may remain unowned or silently terminal.'
          else 'Review completed routed intents and continue governed intake resolution.'
        end,
        sla_due_at = combined_open_due_at,
        reconciliation_status = 'ACCOUNTED',
        reconciliation_issue = null
    where id = discovered_intake_id;
  end if;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    discovered_intake_id,
    case
      when p_target_status = 'RESOLVED' then 'BUSINESS_INTENT_RESOLVED'
      else 'BUSINESS_INTENT_EXPLICITLY_CLOSED'
    end,
    actor_id,
    jsonb_build_object(
      'intent_id', p_intent_id,
      'routing_key', intent_row.routing_key,
      'intent_type', intent_row.intent_type,
      'from_status', intent_row.status,
      'to_status', p_target_status,
      'outcome_evidence', case when p_target_status = 'RESOLVED' then p_outcome_evidence else null end,
      'closure_reason', case when p_target_status = 'EXPLICITLY_CLOSED' then btrim(p_closure_reason) else null end,
      'remaining_open_intent_count', remaining_open_count,
      'remaining_due_at', remaining_due_at,
      'open_clarification_count', open_clarification_count,
      'open_clarification_due_at', open_clarification_due_at,
      'combined_open_due_at', combined_open_due_at
    )
  );

  return discovered_intake_id;
end;
$$;

revoke all on function public.transition_whatsapp_business_intake_intent(uuid, text, jsonb, text) from public;
revoke all on function public.transition_whatsapp_business_intake_intent(uuid, text, jsonb, text) from anon;
grant execute on function public.transition_whatsapp_business_intake_intent(uuid, text, jsonb, text) to authenticated;

comment on function public.transition_whatsapp_business_intake_intent(uuid, text, jsonb, text) is
  'Authorized, parent-before-child row-locked terminal transition for routed B2B WhatsApp intents. Requires outcome evidence for resolution or reason for explicit closure, recalculates remaining parent work, and appends immutable audit evidence.';
