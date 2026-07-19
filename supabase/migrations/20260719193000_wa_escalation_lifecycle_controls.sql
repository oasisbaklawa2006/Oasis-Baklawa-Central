-- Governed acknowledgement and resolution lifecycle for WhatsApp intake escalations.
-- Function-only writes with row locking, stale-state rejection, ownership checks, and append-only audit evidence.

create or replace function public.acknowledge_whatsapp_business_intake_escalation(
  p_escalation_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_intake_id uuid;
  v_to_owner uuid;
  v_acknowledged_by uuid;
begin
  if not public.is_whatsapp_inbox_reader(v_actor) then
    raise exception 'not authorized';
  end if;

  select intake_id, to_owner_user_id, acknowledged_by_user_id
  into v_intake_id, v_to_owner, v_acknowledged_by
  from public.whatsapp_business_intake_escalations
  where id = p_escalation_id and resolved_at is null
  for update;

  if not found then
    raise exception 'open escalation not found';
  end if;
  if v_to_owner <> v_actor then
    raise exception 'only the assigned escalation owner may acknowledge';
  end if;
  if v_acknowledged_by is not null then
    if v_acknowledged_by = v_actor then
      return;
    end if;
    raise exception 'escalation already acknowledged by another user';
  end if;

  update public.whatsapp_business_intake_escalations
  set acknowledged_by_user_id = v_actor,
      acknowledged_at = now()
  where id = p_escalation_id and acknowledged_by_user_id is null and resolved_at is null;

  if not found then
    raise exception 'escalation acknowledgement lost a concurrent race';
  end if;

  insert into public.whatsapp_business_intake_audit_log(intake_id, event_type, actor_user_id, event_data)
  values (v_intake_id, 'ESCALATION_ACKNOWLEDGED', v_actor, jsonb_build_object(
    'escalation_id', p_escalation_id
  ));
end;
$$;

create or replace function public.resolve_whatsapp_business_intake_escalation(
  p_escalation_id uuid,
  p_resolution_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_intake_id uuid;
  v_to_owner uuid;
  v_escalated_by uuid;
  v_acknowledged_by uuid;
begin
  if not public.is_whatsapp_inbox_reader(v_actor) then
    raise exception 'not authorized';
  end if;
  if nullif(btrim(p_resolution_note), '') is null then
    raise exception 'resolution note is required';
  end if;

  select intake_id, to_owner_user_id, escalated_by_user_id, acknowledged_by_user_id
  into v_intake_id, v_to_owner, v_escalated_by, v_acknowledged_by
  from public.whatsapp_business_intake_escalations
  where id = p_escalation_id and resolved_at is null
  for update;

  if not found then
    raise exception 'open escalation not found';
  end if;
  if v_actor not in (v_to_owner, v_escalated_by) then
    raise exception 'only the escalation owner or escalator may resolve';
  end if;
  if v_acknowledged_by is null then
    raise exception 'escalation must be acknowledged before resolution';
  end if;

  perform 1
  from public.whatsapp_business_intakes
  where id = v_intake_id and disposition = 'ACTIVE_PENDING'
  for update;
  if not found then
    raise exception 'escalation intake is no longer active pending';
  end if;

  update public.whatsapp_business_intake_escalations
  set resolved_by_user_id = v_actor,
      resolved_at = now(),
      resolution_note = btrim(p_resolution_note)
  where id = p_escalation_id and resolved_at is null;

  if not found then
    raise exception 'escalation resolution lost a concurrent race';
  end if;

  insert into public.whatsapp_business_intake_audit_log(intake_id, event_type, actor_user_id, event_data)
  values (v_intake_id, 'ESCALATION_RESOLVED', v_actor, jsonb_build_object(
    'escalation_id', p_escalation_id,
    'resolution_note', btrim(p_resolution_note)
  ));
end;
$$;

revoke all on function public.acknowledge_whatsapp_business_intake_escalation(uuid) from public, anon;
grant execute on function public.acknowledge_whatsapp_business_intake_escalation(uuid) to authenticated;
revoke all on function public.resolve_whatsapp_business_intake_escalation(uuid,text) from public, anon;
grant execute on function public.resolve_whatsapp_business_intake_escalation(uuid,text) to authenticated;

comment on function public.acknowledge_whatsapp_business_intake_escalation(uuid) is
  'Idempotent owner-only acknowledgement of an open escalation with append-only intake audit evidence.';
comment on function public.resolve_whatsapp_business_intake_escalation(uuid,text) is
  'Acknowledgement-gated resolution of an open escalation by its owner or escalator; the intake must remain ACTIVE_PENDING.';
