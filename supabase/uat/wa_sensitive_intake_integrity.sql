\set ON_ERROR_STOP on

begin;

do $$
declare
  case_id_value uuid;
  evidence_id_value uuid;
  proof_id_value uuid;
begin
  select id into case_id_value
  from public.whatsapp_communication_cases
  limit 1;

  if case_id_value is null then
    raise exception 'UAT fixture requires one communication case';
  end if;

  insert into public.whatsapp_case_restricted_evidence (
    case_id, evidence_type, storage_reference, content_hash, public_mask,
    access_class, detected_by, correlation_key
  ) values (
    case_id_value, 'PAYMENT_PROOF', 'uat/restricted-proof',
    encode(digest(gen_random_uuid()::text, 'sha256'), 'hex'), '[payment proof]',
    'FINANCE_ONLY', 'OPERATOR', 'uat-evidence-' || gen_random_uuid()
  ) returning id into evidence_id_value;

  begin
    update public.whatsapp_case_restricted_evidence
    set quarantine_status = 'RELEASED'
    where id = evidence_id_value;
    raise exception 'expected RELEASED evidence without review metadata to fail';
  exception when check_violation then
    null;
  end;

  insert into public.whatsapp_case_payment_proofs (
    case_id, restricted_evidence_id, receipt_status, received_at, correlation_key
  ) values (
    case_id_value, evidence_id_value, 'RECEIVED', statement_timestamp(),
    'uat-proof-' || gen_random_uuid()
  ) returning id into proof_id_value;

  begin
    update public.whatsapp_case_payment_proofs
    set receipt_status = 'UNDER_REVIEW', verified_reference = 'must-not-survive'
    where id = proof_id_value;
    raise exception 'expected unverified payment proof with verification data to fail';
  exception when check_violation or raise_exception then
    if sqlerrm = 'expected unverified payment proof with verification data to fail' then
      raise;
    end if;
  end;

  begin
    delete from public.whatsapp_case_payment_proofs where id = proof_id_value;
    raise exception 'expected payment-proof deletion to fail';
  exception when raise_exception then
    if sqlerrm = 'expected payment-proof deletion to fail' then
      raise;
    end if;
  end;

  begin
    insert into public.whatsapp_case_channel_migrations (
      case_id, from_phone_e164, official_phone_e164, status,
      recorded_by, correlation_key
    ) values (
      case_id_value, '+919999999991', '+919999999992',
      'CUSTOMER_ACKNOWLEDGED', gen_random_uuid(), 'uat-channel-' || gen_random_uuid()
    );
    raise exception 'expected acknowledgement without source message to fail';
  exception when check_violation then
    null;
  end;
end;
$$;

rollback;
