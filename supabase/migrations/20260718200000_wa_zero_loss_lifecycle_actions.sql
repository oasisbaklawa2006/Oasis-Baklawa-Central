-- WhatsApp B2B zero-loss governed lifecycle actions.
-- Canonical authority:
--   branch: docs/whatsapp-intent-zero-loss-governance
--   commit: d8000bad8bed157ed8f44a02a59d4677ca32c1b8
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
--   docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md
-- Foundation migrations:
--   20260718173000_wa_zero_loss_intake_foundation.sql
--   20260718190000_wa_zero_loss_inbound_wiring.sql
--   20260718193000_wa_zero_loss_operator_queue.sql
--
-- Scope: permit authorized operators to move governed intakes through explicit
-- pending states or explicitly close them. This function cannot create drafts,
-- orders, finance, dispatch, or inventory records and cannot mark an intake converted.

create or replace function public.transition_whatsapp_business_intake(
  p_intake_id uuid,
  p_target_state text,
  p_next_action text default null,
  p_closure_reason text default null,
  p_assigned_user_id uuid default null,
  p_assigned_team text default null,
  p_sla_due_at timestamptz default null
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  current_row public.whatsapp_business_intakes%rowtype;
  target_disposition text;
  effective_assigned_user_id uuid;
  effective_assigned_team text;
  effective_next_action text;
begin
  if auth.uid() is null or not public.is_whatsapp_inbox_reader(auth.uid()) then
    raise exception 'not authorized to transition WhatsApp business intakes' using errcode = '42501';
  end if;

  if p_target_state not in (
    'RECEIVED',
    'AWAITING_CLASSIFICATION',
    'AWAITING_CUSTOMER',
    'AWAITING_PRODUCT',
    'AWAITING_QUANTITY',
    'AWAITING_OTHER_CLARIFICATION',
    'READY_FOR_OPERATOR_REVIEW',
    'EXPLICITLY_CLOSED'
  ) then
    raise exception 'unsupported target lifecycle state: %', p_target_state using errcode = '22023';
  end if;

  select *
  into current_row
  from public.whatsapp_business_intakes
  where id = p_intake_id
    and business_domain = 'B2B'
  for update;

  if not found then
    raise exception 'WhatsApp business intake not found' using errcode = 'P0002';
  end if;

  if current_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp business intake cannot be transitioned' using errcode = '55000';
  end if;

  effective_assigned_user_id := coalesce(p_assigned_user_id, current_row.assigned_user_id);
  effective_assigned_team := coalesce(nullif(btrim(p_assigned_team), ''), current_row.assigned_team);

  if effective_assigned_user_id is null and effective_assigned_team is null and current_row.escalation_owner_user_id is null then
    raise exception 'an active intake must retain an owner' using errcode = '23514';
  end if;

  if p_target_state = 'EXPLICITLY_CLOSED' then
    if nullif(btrim(p_closure_reason), '') is null then
      raise exception 'closure reason is required' using errcode = '23514';
    end if;

    target_disposition := 'EXPLICITLY_CLOSED';
    effective_next_action := null;
  else
    if nullif(btrim(p_next_action), '') is null then
      raise exception 'next action is required for an active intake' using errcode = '23514';
    end if;

    target_disposition := 'ACTIVE_PENDING';
    effective_next_action := btrim(p_next_action);
  end if;

  update public.whatsapp_business_intakes
  set
    lifecycle_state = p_target_state,
    disposition = target_disposition,
    assigned_user_id = effective_assigned_user_id,
    assigned_team = effective_assigned_team,
    next_action = effective_next_action,
    sla_due_at = case when target_disposition = 'ACTIVE_PENDING' then p_sla_due_at else null end,
    closure_reason = case when target_disposition = 'EXPLICITLY_CLOSED' then btrim(p_closure_reason) else null end,
    closed_by_user_id = case when target_disposition = 'EXPLICITLY_CLOSED' then auth.uid() else null end,
    closed_at = case when target_disposition = 'EXPLICITLY_CLOSED' then now() else null end,
    reconciliation_status = 'ACCOUNTED',
    reconciliation_issue = null
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id,
    event_type,
    actor_user_id,
    event_data
  ) values (
    p_intake_id,
    case when target_disposition = 'EXPLICITLY_CLOSED' then 'EXPLICITLY_CLOSED' else 'LIFECYCLE_TRANSITIONED' end,
    auth.uid(),
    jsonb_build_object(
      'from_lifecycle_state', current_row.lifecycle_state,
      'to_lifecycle_state', p_target_state,
      'from_disposition', current_row.disposition,
      'to_disposition', target_disposition,
      'previous_assigned_user_id', current_row.assigned_user_id,
      'assigned_user_id', effective_assigned_user_id,
      'previous_assigned_team', current_row.assigned_team,
      'assigned_team', effective_assigned_team,
      'next_action', effective_next_action,
      'sla_due_at', case when target_disposition = 'ACTIVE_PENDING' then p_sla_due_at else null end,
      'closure_reason', case when target_disposition = 'EXPLICITLY_CLOSED' then btrim(p_closure_reason) else null end
    )
  );

  return p_intake_id;
end;
$$;

revoke all on function public.transition_whatsapp_business_intake(uuid, text, text, text, uuid, text, timestamptz) from public;
revoke all on function public.transition_whatsapp_business_intake(uuid, text, text, text, uuid, text, timestamptz) from anon;
grant execute on function public.transition_whatsapp_business_intake(uuid, text, text, text, uuid, text, timestamptz) to authenticated;

comment on function public.transition_whatsapp_business_intake(uuid, text, text, text, uuid, text, timestamptz) is
  'Race-safe governed lifecycle transition for B2B WhatsApp intakes. Requires ownership and next action for pending work, requires reason and actor for explicit closure, appends an audit event, and cannot create or convert executable orders.';
