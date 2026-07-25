-- Database regression proof for WhatsApp final reconciliation integrity.
-- Run only after applying 20260725230000_wa_final_reconciliation_and_retirement.sql
-- in an isolated UAT database. The transaction is always rolled back.

begin;

do $$
declare
  actor_id uuid := gen_random_uuid();
  signed_run_id uuid := gen_random_uuid();
  open_run_id uuid := gen_random_uuid();
  resolved_exception_id uuid := gen_random_uuid();
  retirement_id uuid := gen_random_uuid();
begin
  insert into public.whatsapp_reconciliation_runs (
    id, window_start, window_end, shift_code, raw_message_count,
    packet_fragment_count, case_source_count, orphan_message_count,
    duplicate_count, unresolved_count, status, reconciled_by,
    signed_off_by, signed_off_at, correlation_key
  ) values (
    signed_run_id, now() - interval '2 hours', now() - interval '1 hour',
    'UAT-SIGNED', 1, 1, 1, 0, 0, 0, 'SIGNED_OFF', actor_id,
    actor_id, now(), 'uat-wa-signed-' || signed_run_id
  );

  begin
    insert into public.whatsapp_reconciliation_exceptions (
      reconciliation_run_id, exception_type, business_object_type,
      details, owner_id, due_at
    ) values (
      signed_run_id, 'OTHER', 'uat', '{}'::jsonb, actor_id, now()
    );
    raise exception 'UAT failure: signed-off run accepted an open exception';
  exception
    when raise_exception then
      if sqlerrm <> 'open exception cannot be added to or reopened on a signed-off reconciliation' then
        raise;
      end if;
  end;

  insert into public.whatsapp_reconciliation_runs (
    id, window_start, window_end, shift_code, raw_message_count,
    packet_fragment_count, case_source_count, orphan_message_count,
    duplicate_count, unresolved_count, status, reconciled_by, correlation_key
  ) values (
    open_run_id, now() - interval '2 hours', now() - interval '1 hour',
    'UAT-OPEN', 1, 1, 1, 0, 0, 0, 'EXCEPTIONS_OPEN', actor_id,
    'uat-wa-open-' || open_run_id
  );

  insert into public.whatsapp_reconciliation_exceptions (
    id, reconciliation_run_id, exception_type, business_object_type,
    details, owner_id, due_at
  ) values (
    resolved_exception_id, open_run_id, 'OTHER', 'uat',
    '{}'::jsonb, actor_id, now()
  );

  begin
    update public.whatsapp_reconciliation_runs
      set status = 'SIGNED_OFF', signed_off_by = actor_id, signed_off_at = now()
      where id = open_run_id;
    raise exception 'UAT failure: run signed off with an open exception';
  exception
    when raise_exception then
      if sqlerrm <> 'shift reconciliation cannot be signed off with open exceptions' then
        raise;
      end if;
  end;

  update public.whatsapp_reconciliation_exceptions
    set resolved_at = now(), resolved_by = actor_id, resolution = 'UAT resolved'
    where id = resolved_exception_id;
  update public.whatsapp_reconciliation_runs
    set status = 'SIGNED_OFF', signed_off_by = actor_id, signed_off_at = now()
    where id = open_run_id;

  begin
    update public.whatsapp_reconciliation_exceptions
      set resolved_at = null, resolved_by = null, resolution = null
      where id = resolved_exception_id;
    raise exception 'UAT failure: exception reopened after sign-off';
  exception
    when raise_exception then
      if sqlerrm <> 'open exception cannot be added to or reopened on a signed-off reconciliation' then
        raise;
      end if;
  end;

  insert into public.whatsapp_legacy_capability_retirements (
    id, capability_key, legacy_surface, disposition, canonical_destination,
    commercial_write_authority, evidence, verified_by
  ) values (
    retirement_id, 'uat-capability', 'uat-legacy', 'RETIRED', 'uat-canonical',
    false, '{}'::jsonb, actor_id
  );

  begin
    update public.whatsapp_legacy_capability_retirements
      set canonical_destination = 'tampered'
      where id = retirement_id;
    raise exception 'UAT failure: retirement evidence remained editable';
  exception
    when raise_exception then
      if sqlerrm <> 'WhatsApp legacy retirement evidence is append-only' then
        raise;
      end if;
  end;

  insert into public.whatsapp_legacy_capability_retirements (
    capability_key, revision_number, supersedes_retirement_id, legacy_surface,
    disposition, canonical_destination, commercial_write_authority, evidence, verified_by
  ) values (
    'uat-capability', 2, retirement_id, 'uat-legacy', 'MIGRATED_READ_ONLY',
    'uat-canonical-v2', false, '{"correction": true}'::jsonb, actor_id
  );
end;
$$;

rollback;
