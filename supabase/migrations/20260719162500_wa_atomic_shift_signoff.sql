-- Make WhatsApp shift sign-off atomic with respect to intake and escalation writes.
-- The source tables are locked in SHARE mode before reconciliation counts are read,
-- so concurrent INSERT/UPDATE/DELETE operations cannot change the sign-off inputs
-- until the reconciliation row has been updated and the transaction completes.

create or replace function public.signoff_whatsapp_shift_reconciliation(
  p_reconciliation_id uuid,
  p_signoff_status text,
  p_supervisor_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_prepared_by uuid;
  v_potential_received bigint;
  v_converted bigint;
  v_active_pending bigint;
  v_explicitly_closed bigint;
  v_unaccounted bigint;
  v_open_escalations bigint;
begin
  if not public.is_whatsapp_inbox_reader(v_actor) then
    raise exception 'not authorized';
  end if;
  if p_signoff_status not in ('SIGNED_OFF','REJECTED') then
    raise exception 'invalid signoff status';
  end if;
  if nullif(btrim(p_supervisor_note), '') is null then
    raise exception 'supervisor note is required';
  end if;

  select prepared_by_user_id into v_prepared_by
  from public.whatsapp_shift_reconciliations
  where id = p_reconciliation_id and signoff_status = 'PENDING'
  for update;
  if not found then raise exception 'pending reconciliation not found'; end if;
  if v_prepared_by = v_actor then
    raise exception 'preparer cannot self-certify shift reconciliation';
  end if;

  -- Bound contention and deadlock waits without changing the caller's session.
  perform set_config('lock_timeout', '5s', true);

  -- Block concurrent source-table mutations until sign-off commits. SHARE mode
  -- permits concurrent readers but conflicts with the ROW EXCLUSIVE lock taken
  -- by INSERT/UPDATE/DELETE, making the following source snapshot stable.
  lock table public.whatsapp_business_intakes in share mode;
  lock table public.whatsapp_business_intake_escalations in share mode;

  select potential_received, converted, active_pending, explicitly_closed, unaccounted_potential_orders
  into v_potential_received, v_converted, v_active_pending, v_explicitly_closed, v_unaccounted
  from public.whatsapp_business_intake_reconciliation;

  select count(*)::bigint into v_open_escalations
  from public.whatsapp_business_intake_escalations
  where resolved_at is null;

  if p_signoff_status = 'SIGNED_OFF' and (v_unaccounted <> 0 or v_open_escalations <> 0) then
    raise exception 'shift is not clean for sign-off';
  end if;

  update public.whatsapp_shift_reconciliations
  set potential_received = v_potential_received,
      converted = v_converted,
      active_pending = v_active_pending,
      explicitly_closed = v_explicitly_closed,
      unaccounted_potential_orders = v_unaccounted,
      open_escalations = v_open_escalations,
      signoff_status = p_signoff_status,
      supervisor_user_id = v_actor,
      supervisor_note = btrim(p_supervisor_note),
      signed_off_at = now()
  where id = p_reconciliation_id;
end;
$$;

revoke all on function public.signoff_whatsapp_shift_reconciliation(uuid,text,text) from public, anon;
grant execute on function public.signoff_whatsapp_shift_reconciliation(uuid,text,text) to authenticated;
