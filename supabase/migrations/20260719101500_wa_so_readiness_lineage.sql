-- Governed WhatsApp intake -> sales order draft readiness lineage.
-- Never creates or mutates live orders/order_items, finance, dispatch, or inventory truth.

create table public.whatsapp_so_readiness_lineage (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  sales_order_draft_id uuid not null references public.sales_order_drafts(id) on delete restrict,
  source_packet_id uuid not null references public.whatsapp_message_packets(id) on delete restrict,
  status text not null check (status in ('BLOCKED','READY_FOR_OPERATOR_APPROVAL')),
  readiness_evidence jsonb not null check (readiness_evidence not in ('{}'::jsonb,'null'::jsonb)),
  blocker_codes text[] not null default '{}',
  assigned_user_id uuid null references public.users(id) on delete restrict,
  assigned_team text null,
  next_action text not null check (nullif(btrim(next_action),'') is not null),
  due_at timestamptz null,
  created_by_user_id uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (intake_id,sales_order_draft_id),
  constraint whatsapp_so_readiness_owner_required check (assigned_user_id is not null or nullif(btrim(assigned_team),'') is not null),
  constraint whatsapp_so_readiness_state_shape check (
    (status='BLOCKED' and cardinality(blocker_codes)>0 and due_at is not null)
    or (status='READY_FOR_OPERATOR_APPROVAL' and cardinality(blocker_codes)=0)
  )
);
create index whatsapp_so_readiness_queue_idx on public.whatsapp_so_readiness_lineage(status,due_at,assigned_team,assigned_user_id);
alter table public.whatsapp_so_readiness_lineage enable row level security;
create policy whatsapp_so_readiness_read on public.whatsapp_so_readiness_lineage for select to authenticated using (public.is_whatsapp_inbox_reader(auth.uid()));
revoke insert,update,delete,truncate on public.whatsapp_so_readiness_lineage from public,anon,authenticated;
grant select on public.whatsapp_so_readiness_lineage to authenticated;

create or replace function public.evaluate_whatsapp_so_readiness(
  p_intake_id uuid,p_sales_order_draft_id uuid,p_readiness_evidence jsonb,
  p_assigned_user_id uuid default null,p_assigned_team text default null,p_due_at timestamptz default null
) returns uuid language plpgsql security definer set search_path=pg_catalog,public as $$
declare
  actor_id uuid:=auth.uid(); intake_row public.whatsapp_business_intakes%rowtype;
  draft_row public.sales_order_drafts%rowtype; blockers text[]:='{}'; lineage_id uuid;
  effective_user uuid; effective_team text;
begin
  if actor_id is null or not public.is_whatsapp_inbox_reader(actor_id) then raise exception 'not authorized to evaluate WhatsApp SO readiness' using errcode='42501'; end if;
  if p_readiness_evidence is null or p_readiness_evidence in ('{}'::jsonb,'null'::jsonb) then raise exception 'non-empty SO readiness evidence is required' using errcode='23514'; end if;
  select * into intake_row from public.whatsapp_business_intakes where id=p_intake_id and business_domain='B2B' for update;
  if not found then raise exception 'WhatsApp business intake not found' using errcode='P0002'; end if;
  if intake_row.disposition in ('CONVERTED','EXPLICITLY_CLOSED') then raise exception 'terminal WhatsApp intake cannot enter SO readiness' using errcode='55000'; end if;
  select * into draft_row from public.sales_order_drafts where id=p_sales_order_draft_id for update;
  if not found then raise exception 'sales order draft not found' using errcode='P0002'; end if;

  if intake_row.packet_id is null or draft_row.packet_id is distinct from intake_row.packet_id then blockers:=array_append(blockers,'SOURCE_PACKET_MISMATCH'); end if;
  if intake_row.identity_resolution_status<>'RESOLVED' then blockers:=array_append(blockers,'IDENTITY_TRIAD_UNRESOLVED'); end if;
  if intake_row.original_communicator_contact_id is null and intake_row.original_communicator_user_id is null then blockers:=array_append(blockers,'ORIGINAL_COMMUNICATOR_REQUIRED'); end if;
  if intake_row.commercial_customer_id is null then blockers:=array_append(blockers,'INTAKE_CUSTOMER_REQUIRED'); end if;
  if draft_row.company_id is null or draft_row.company_id is distinct from intake_row.commercial_customer_id then blockers:=array_append(blockers,'CUSTOMER_LINEAGE_MISMATCH'); end if;
  if draft_row.readiness_overall_score<100 then blockers:=array_append(blockers,'DRAFT_READINESS_INCOMPLETE'); end if;
  if exists(select 1 from public.whatsapp_business_intake_clarifications where intake_id=p_intake_id and status='OPEN') then blockers:=array_append(blockers,'OPEN_CLARIFICATION'); end if;
  if exists(select 1 from public.whatsapp_multimodal_artifacts where intake_id=p_intake_id and status not in ('SUCCEEDED','EXPLICITLY_CLOSED')) then blockers:=array_append(blockers,'UNRESOLVED_MULTIMODAL_WORK'); end if;
  if exists(select 1 from public.whatsapp_business_intake_intents where intake_id=p_intake_id and status='OPEN') then blockers:=array_append(blockers,'UNRESOLVED_ROUTED_INTENT'); end if;

  effective_user:=coalesce(p_assigned_user_id,intake_row.assigned_user_id);
  effective_team:=coalesce(nullif(btrim(p_assigned_team),''),intake_row.assigned_team);
  if effective_user is null and effective_team is null then raise exception 'SO readiness work must retain an owner' using errcode='23514'; end if;

  insert into public.whatsapp_so_readiness_lineage(intake_id,sales_order_draft_id,source_packet_id,status,readiness_evidence,blocker_codes,assigned_user_id,assigned_team,next_action,due_at,created_by_user_id)
  values(p_intake_id,p_sales_order_draft_id,draft_row.packet_id,case when cardinality(blockers)=0 then 'READY_FOR_OPERATOR_APPROVAL' else 'BLOCKED' end,
    p_readiness_evidence,blockers,effective_user,effective_team,
    case when cardinality(blockers)=0 then 'Complete governed operator approval; this record cannot create a live order.' else 'Resolve every recorded SO-readiness blocker.' end,
    case when cardinality(blockers)=0 then null else coalesce(p_due_at,intake_row.sla_due_at,now()+interval '4 hours') end,actor_id)
  on conflict(intake_id,sales_order_draft_id) do update set status=excluded.status,readiness_evidence=excluded.readiness_evidence,blocker_codes=excluded.blocker_codes,
    assigned_user_id=excluded.assigned_user_id,assigned_team=excluded.assigned_team,next_action=excluded.next_action,due_at=excluded.due_at,updated_at=now()
  returning id into lineage_id;

  update public.whatsapp_business_intakes set sales_order_draft_id=p_sales_order_draft_id,
    lifecycle_state=case when cardinality(blockers)=0 then 'READY_FOR_OPERATOR_REVIEW' else lifecycle_state end,
    disposition='ACTIVE_PENDING',next_action=case when cardinality(blockers)=0 then 'Review governed sales order draft; live SO creation remains separately controlled.' else 'Resolve every recorded SO-readiness blocker.' end,
    reconciliation_status='ACCOUNTED',reconciliation_issue=null where id=p_intake_id;
  insert into public.whatsapp_business_intake_audit_log(intake_id,event_type,actor_user_id,event_data)
  values(p_intake_id,'SO_READINESS_EVALUATED',actor_id,jsonb_build_object('lineage_id',lineage_id,'sales_order_draft_id',p_sales_order_draft_id,'source_packet_id',draft_row.packet_id,'blocker_codes',to_jsonb(blockers),'ready',cardinality(blockers)=0,'readiness_evidence',p_readiness_evidence));
  return lineage_id;
end;$$;
revoke all on function public.evaluate_whatsapp_so_readiness(uuid,uuid,jsonb,uuid,text,timestamptz) from public,anon;
grant execute on function public.evaluate_whatsapp_so_readiness(uuid,uuid,jsonb,uuid,text,timestamptz) to authenticated;
comment on table public.whatsapp_so_readiness_lineage is 'Evidence-backed, owned handoff from authorized WhatsApp intake to a reviewable sales order draft. Never creates live orders.';
