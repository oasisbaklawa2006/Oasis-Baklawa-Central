-- Failure-safe multimodal intake for governed B2B WhatsApp packets.
-- AI/media failure creates durable human work; it never suppresses or closes an intake.

create table public.whatsapp_multimodal_artifacts (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  source_message_key text not null check (nullif(btrim(source_message_key), '') is not null),
  media_kind text not null check (media_kind in ('VOICE','IMAGE','HANDWRITING','PDF','PAYMENT_SCREENSHOT','VIDEO','CAPTION','OTHER')),
  source_storage_ref text not null check (nullif(btrim(source_storage_ref), '') is not null),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SUCCEEDED','FAILED_RETRYABLE','FAILED_REVIEW_REQUIRED','EXPLICITLY_CLOSED')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  extraction_result jsonb null,
  extraction_evidence jsonb null,
  failure_code text null,
  failure_detail text null,
  next_retry_at timestamptz null,
  assigned_user_id uuid null references public.users(id) on delete restrict,
  assigned_team text null,
  due_at timestamptz not null,
  closed_reason text null,
  closed_by_user_id uuid null references public.users(id) on delete restrict,
  closed_at timestamptz null,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_multimodal_owner_required check (
    assigned_user_id is not null or nullif(btrim(assigned_team), '') is not null
  ),
  constraint whatsapp_multimodal_state_shape check (
    (status in ('PENDING','PROCESSING') and extraction_result is null and failure_code is null and closed_at is null)
    or (status = 'SUCCEEDED' and extraction_result is not null and extraction_evidence is not null and failure_code is null and closed_at is null)
    or (status = 'FAILED_RETRYABLE' and nullif(btrim(failure_code), '') is not null and next_retry_at is not null and closed_at is null)
    or (status = 'FAILED_REVIEW_REQUIRED' and nullif(btrim(failure_code), '') is not null and next_retry_at is null and closed_at is null)
    or (status = 'EXPLICITLY_CLOSED' and nullif(btrim(closed_reason), '') is not null and closed_by_user_id is not null and closed_at is not null)
  ),
  unique (intake_id, source_message_key, source_sha256)
);

create index whatsapp_multimodal_failure_queue_idx
  on public.whatsapp_multimodal_artifacts(status, due_at, assigned_team, assigned_user_id);
alter table public.whatsapp_multimodal_artifacts enable row level security;
create policy whatsapp_multimodal_artifacts_read on public.whatsapp_multimodal_artifacts
  for select to authenticated using (public.is_whatsapp_inbox_reader(auth.uid()));
revoke insert, update, delete, truncate on public.whatsapp_multimodal_artifacts from public, anon, authenticated;
grant select on public.whatsapp_multimodal_artifacts to authenticated;

create or replace function public.register_whatsapp_multimodal_artifact(
  p_intake_id uuid, p_source_message_key text, p_media_kind text,
  p_source_storage_ref text, p_source_sha256 text,
  p_assigned_user_id uuid default null, p_assigned_team text default null,
  p_due_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor_id uuid := auth.uid();
  intake_row public.whatsapp_business_intakes%rowtype;
  artifact_id uuid;
  effective_user uuid;
  effective_team text;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to register WhatsApp multimodal artifacts' using errcode='42501';
  end if;
  if p_media_kind is null or p_media_kind not in ('VOICE','IMAGE','HANDWRITING','PDF','PAYMENT_SCREENSHOT','VIDEO','CAPTION','OTHER') then
    raise exception 'unsupported WhatsApp media kind: %', p_media_kind using errcode='22023';
  end if;
  if nullif(btrim(p_source_message_key),'') is null or nullif(btrim(p_source_storage_ref),'') is null
     or p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' or p_due_at is null then
    raise exception 'source identity, storage reference, sha256, and due time are required' using errcode='23514';
  end if;

  select * into intake_row from public.whatsapp_business_intakes
  where id=p_intake_id and business_domain='B2B' for update;
  if not found then raise exception 'WhatsApp business intake not found' using errcode='P0002'; end if;
  if intake_row.disposition in ('CONVERTED','EXPLICITLY_CLOSED') then
    raise exception 'terminal WhatsApp intake cannot accept media' using errcode='55000';
  end if;
  effective_user := coalesce(p_assigned_user_id, intake_row.assigned_user_id);
  effective_team := coalesce(nullif(btrim(p_assigned_team),''), intake_row.assigned_team);
  if effective_user is null and effective_team is null then
    raise exception 'multimodal work must retain an owner' using errcode='23514';
  end if;

  insert into public.whatsapp_multimodal_artifacts(
    intake_id,source_message_key,media_kind,source_storage_ref,source_sha256,
    assigned_user_id,assigned_team,due_at,created_by_user_id
  ) values (
    p_intake_id,btrim(p_source_message_key),p_media_kind,btrim(p_source_storage_ref),p_source_sha256,
    effective_user,effective_team,p_due_at,actor_id
  ) on conflict (intake_id,source_message_key,source_sha256) do update
    set updated_at=public.whatsapp_multimodal_artifacts.updated_at
  returning id into artifact_id;

  update public.whatsapp_business_intakes set
    disposition='ACTIVE_PENDING',
    next_action=case
      when exists(select 1 from public.whatsapp_business_intake_clarifications where intake_id=p_intake_id and status='OPEN')
        then intake_row.next_action
      else 'Process every captured media artifact; extraction failure must remain visible human work.'
    end,
    sla_due_at=least(intake_row.sla_due_at,p_due_at),
    reconciliation_status='ACCOUNTED', reconciliation_issue=null
  where id=p_intake_id;

  insert into public.whatsapp_business_intake_audit_log(intake_id,event_type,actor_user_id,event_data)
  values(p_intake_id,'MULTIMODAL_ARTIFACT_CAPTURED',actor_id,
    jsonb_build_object('artifact_id',artifact_id,'source_message_key',btrim(p_source_message_key),
      'media_kind',p_media_kind,'source_sha256',p_source_sha256,'due_at',p_due_at));
  return artifact_id;
end; $$;

create or replace function public.record_whatsapp_multimodal_outcome(
  p_artifact_id uuid, p_target_status text, p_attempt_evidence jsonb,
  p_extraction_result jsonb default null, p_failure_code text default null,
  p_failure_detail text default null, p_next_retry_at timestamptz default null,
  p_closed_reason text default null
) returns uuid language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  actor_id uuid := auth.uid();
  discovered_intake_id uuid;
  intake_row public.whatsapp_business_intakes%rowtype;
  artifact_row public.whatsapp_multimodal_artifacts%rowtype;
  remaining_media_count bigint;
  open_clarification_count bigint;
  remaining_work_count bigint;
  remaining_due_at timestamptz;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then
    raise exception 'not authorized to record WhatsApp multimodal outcomes' using errcode='42501';
  end if;
  if p_target_status is null or p_target_status not in ('PROCESSING','SUCCEEDED','FAILED_RETRYABLE','FAILED_REVIEW_REQUIRED','EXPLICITLY_CLOSED') then
    raise exception 'unsupported multimodal outcome: %',p_target_status using errcode='22023';
  end if;
  if p_attempt_evidence is null or p_attempt_evidence in ('{}'::jsonb,'null'::jsonb) then
    raise exception 'non-empty attempt evidence is required' using errcode='23514';
  end if;
  if p_target_status='SUCCEEDED' and (p_extraction_result is null or p_extraction_result in ('{}'::jsonb,'null'::jsonb)) then
    raise exception 'successful extraction requires a non-empty result' using errcode='23514';
  end if;
  if p_target_status in ('FAILED_RETRYABLE','FAILED_REVIEW_REQUIRED') and nullif(btrim(p_failure_code),'') is null then
    raise exception 'failed extraction requires a failure code' using errcode='23514';
  end if;
  if p_target_status='FAILED_RETRYABLE' and p_next_retry_at is null then
    raise exception 'retryable failure requires next retry time' using errcode='23514';
  end if;
  if p_target_status='EXPLICITLY_CLOSED' and nullif(btrim(p_closed_reason),'') is null then
    raise exception 'explicit media closure requires a reason' using errcode='23514';
  end if;

  select intake_id into discovered_intake_id from public.whatsapp_multimodal_artifacts where id=p_artifact_id;
  if not found then raise exception 'WhatsApp multimodal artifact not found' using errcode='P0002'; end if;
  select * into intake_row from public.whatsapp_business_intakes
  where id=discovered_intake_id and business_domain='B2B' for update;
  if not found then raise exception 'parent WhatsApp intake not found' using errcode='P0002'; end if;
  select * into artifact_row from public.whatsapp_multimodal_artifacts
  where id=p_artifact_id and intake_id=discovered_intake_id for update;
  if artifact_row.status in ('SUCCEEDED','EXPLICITLY_CLOSED') then
    raise exception 'multimodal artifact is already terminal' using errcode='55000';
  end if;

  update public.whatsapp_multimodal_artifacts set
    status=p_target_status,
    attempt_count=attempt_count+1,
    extraction_result=case when p_target_status='SUCCEEDED' then p_extraction_result else null end,
    extraction_evidence=case when p_target_status='SUCCEEDED' then p_attempt_evidence else null end,
    failure_code=case when p_target_status like 'FAILED%' then btrim(p_failure_code) else null end,
    failure_detail=case when p_target_status like 'FAILED%' then nullif(btrim(p_failure_detail),'') else null end,
    next_retry_at=case when p_target_status='FAILED_RETRYABLE' then p_next_retry_at else null end,
    closed_reason=case when p_target_status='EXPLICITLY_CLOSED' then btrim(p_closed_reason) else null end,
    closed_by_user_id=case when p_target_status='EXPLICITLY_CLOSED' then actor_id else null end,
    closed_at=case when p_target_status='EXPLICITLY_CLOSED' then now() else null end,
    updated_at=now()
  where id=p_artifact_id;

  select count(*) into remaining_media_count from public.whatsapp_multimodal_artifacts
  where intake_id=discovered_intake_id and status not in ('SUCCEEDED','EXPLICITLY_CLOSED');
  select count(*) into open_clarification_count from public.whatsapp_business_intake_clarifications
  where intake_id=discovered_intake_id and status='OPEN';

  select count(*),min(due_at) into remaining_work_count,remaining_due_at from (
    select due_at from public.whatsapp_multimodal_artifacts where intake_id=discovered_intake_id and status not in ('SUCCEEDED','EXPLICITLY_CLOSED')
    union all select due_at from public.whatsapp_business_intake_clarifications where intake_id=discovered_intake_id and status='OPEN'
    union all select due_at from public.whatsapp_business_intake_intents where intake_id=discovered_intake_id and status='OPEN'
    union all select due_at from public.whatsapp_contextual_aliases where intake_id=discovered_intake_id and status='PENDING'
  ) governed_open_work;

  if intake_row.disposition='ACTIVE_PENDING' then
    update public.whatsapp_business_intakes set
      next_action=case
        when open_clarification_count>0 then intake_row.next_action
        when remaining_media_count>0 then 'Resolve every pending or failed media artifact; AI failure is visible human work.'
        when remaining_work_count>0 then 'Continue every remaining governed intake work item; none may be silently lost.'
        else 'Review completed governed work and continue intake resolution.'
      end,
      sla_due_at=remaining_due_at,reconciliation_status='ACCOUNTED',reconciliation_issue=null
    where id=discovered_intake_id;
  end if;

  insert into public.whatsapp_business_intake_audit_log(intake_id,event_type,actor_user_id,event_data)
  values(discovered_intake_id,
    case p_target_status when 'SUCCEEDED' then 'MULTIMODAL_EXTRACTION_SUCCEEDED'
      when 'FAILED_RETRYABLE' then 'MULTIMODAL_EXTRACTION_RETRYABLE'
      when 'FAILED_REVIEW_REQUIRED' then 'MULTIMODAL_HUMAN_REVIEW_REQUIRED'
      when 'EXPLICITLY_CLOSED' then 'MULTIMODAL_ARTIFACT_EXPLICITLY_CLOSED'
      else 'MULTIMODAL_EXTRACTION_STARTED' end,
    actor_id,jsonb_build_object('artifact_id',p_artifact_id,'from_status',artifact_row.status,
      'to_status',p_target_status,'attempt_evidence',p_attempt_evidence,'failure_code',p_failure_code,
      'next_retry_at',p_next_retry_at,'remaining_media_count',remaining_media_count,
      'remaining_governed_work_count',remaining_work_count,'remaining_due_at',remaining_due_at));
  return discovered_intake_id;
end; $$;

revoke all on function public.register_whatsapp_multimodal_artifact(uuid,text,text,text,text,uuid,text,timestamptz) from public,anon;
grant execute on function public.register_whatsapp_multimodal_artifact(uuid,text,text,text,text,uuid,text,timestamptz) to authenticated;
revoke all on function public.record_whatsapp_multimodal_outcome(uuid,text,jsonb,jsonb,text,text,timestamptz,text) from public,anon;
grant execute on function public.record_whatsapp_multimodal_outcome(uuid,text,jsonb,jsonb,text,text,timestamptz,text) to authenticated;

comment on table public.whatsapp_multimodal_artifacts is
'Durable source and extraction ledger. Failures remain owned, SLA-bound, visible and reconcilable until success or authorised explicit closure.';
