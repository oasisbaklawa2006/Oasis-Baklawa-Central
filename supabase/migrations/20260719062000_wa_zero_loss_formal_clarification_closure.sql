-- Formal clarification closure and evidence hardening.

alter table public.whatsapp_business_intake_clarifications
  add constraint whatsapp_intake_clarification_answer_evidence_required check (
    status <> 'ANSWERED' or (
      answer_evidence is not null and
      answer_evidence <> '{}'::jsonb and
      answer_evidence <> 'null'::jsonb
    )
  );

revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from public;
revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from anon;
revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from authenticated;

grant select on public.whatsapp_business_intake_clarifications to authenticated;

create or replace function public.cancel_whatsapp_business_intake_clarification(
  p_clarification_id uuid,
  p_cancellation_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  actor_id uuid := auth.uid();
  clarification_row public.whatsapp_business_intake_clarifications%rowtype;
  intake_row public.whatsapp_business_intakes%rowtype;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to cancel WhatsApp intake clarifications' using errcode = '42501';
  end if;

  if nullif(btrim(p_cancellation_reason), '') is null then
    raise exception 'clarification cancellation reason is required' using errcode = '23514';
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
    raise exception 'terminal WhatsApp business intake cannot cancel clarification work' using errcode = '55000';
  end if;

  update public.whatsapp_business_intake_clarifications
  set status = 'CANCELLED',
      cancellation_reason = btrim(p_cancellation_reason),
      cancelled_by_user_id = actor_id,
      cancelled_at = now(),
      updated_at = now()
  where id = p_clarification_id;

  update public.whatsapp_business_intakes
  set disposition = 'ACTIVE_PENDING',
      next_action = 'Review cancelled clarification and define the next governed action.',
      reconciliation_status = 'ACCOUNTED',
      reconciliation_issue = null
  where id = clarification_row.intake_id;

  insert into public.whatsapp_business_intake_audit_log (
    intake_id, event_type, actor_user_id, event_data
  ) values (
    clarification_row.intake_id,
    'CLARIFICATION_CANCELLED',
    actor_id,
    jsonb_build_object(
      'clarification_id', p_clarification_id,
      'clarification_type', clarification_row.clarification_type,
      'question', clarification_row.question,
      'cancellation_reason', btrim(p_cancellation_reason),
      'previous_next_action', intake_row.next_action
    )
  );

  return clarification_row.intake_id;
end;
$$;

revoke all on function public.cancel_whatsapp_business_intake_clarification(uuid, text) from public;
revoke all on function public.cancel_whatsapp_business_intake_clarification(uuid, text) from anon;
grant execute on function public.cancel_whatsapp_business_intake_clarification(uuid, text) to authenticated;

comment on function public.cancel_whatsapp_business_intake_clarification(uuid, text) is
  'Authorized, row-locked explicit cancellation of open clarification work with mandatory reason and immutable intake audit evidence.';
