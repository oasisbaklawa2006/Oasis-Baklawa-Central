-- Governed escalation and end-of-shift reconciliation for zero-loss WhatsApp B2B intake.
-- Additive control-plane objects only; no order, finance, inventory, dispatch, or customer-master writes.

create table public.whatsapp_business_intake_escalations (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  escalation_reason text not null check (nullif(btrim(escalation_reason), '') is not null),
  severity text not null check (severity in ('WARNING','OVERDUE','BREACH')),
  from_owner_user_id uuid null references public.users(id) on delete set null,
  to_owner_user_id uuid not null references public.users(id) on delete restrict,
  escalated_by_user_id uuid not null references public.users(id) on delete restrict,
  escalated_at timestamptz not null default now(),
  acknowledged_by_user_id uuid null references public.users(id) on delete restrict,
  acknowledged_at timestamptz null,
  resolution_note text null,
  resolved_by_user_id uuid null references public.users(id) on delete restrict,
  resolved_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint whatsapp_intake_escalation_ack_pair check (
    (acknowledged_by_user_id is null and acknowledged_at is null) or
    (acknowledged_by_user_id is not null and acknowledged_at is not null)
  ),
  constraint whatsapp_intake_escalation_resolution_pair check (
    (resolved_by_user_id is null and resolved_at is null) or
    (resolved_by_user_id is not null and resolved_at is not null and nullif(btrim(resolution_note), '') is not null)
  )
);

create unique index whatsapp_intake_escalations_one_open_per_intake
  on public.whatsapp_business_intake_escalations(intake_id)
  where resolved_at is null;
create index whatsapp_intake_escalations_owner_queue
  on public.whatsapp_business_intake_escalations(to_owner_user_id, severity, escalated_at)
  where resolved_at is null;

alter table public.whatsapp_business_intake_escalations enable row level security;
create policy whatsapp_intake_escalations_reader_select
on public.whatsapp_business_intake_escalations for select to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));
create policy whatsapp_intake_escalations_reader_insert
on public.whatsapp_business_intake_escalations for insert to authenticated
with check (public.is_whatsapp_inbox_reader(auth.uid()));
create policy whatsapp_intake_escalations_reader_update
on public.whatsapp_business_intake_escalations for update to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()))
with check (public.is_whatsapp_inbox_reader(auth.uid()));

create or replace function public.escalate_whatsapp_business_intake(
  p_intake_id uuid,
  p_to_owner_user_id uuid,
  p_reason text,
  p_severity text default 'OVERDUE'
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_from_owner uuid;
  v_escalation_id uuid;
begin
  if not public.is_whatsapp_inbox_reader(v_actor) then
    raise exception 'not authorized';
  end if;
  if p_severity not in ('WARNING','OVERDUE','BREACH') then
    raise exception 'invalid escalation severity';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'escalation reason is required';
  end if;

  select assigned_user_id into v_from_owner
  from public.whatsapp_business_intakes
  where id = p_intake_id and disposition = 'ACTIVE_PENDING'
  for update;
  if not found then raise exception 'active pending intake not found'; end if;

  update public.whatsapp_business_intake_escalations
  set resolved_by_user_id = v_actor,
      resolved_at = now(),
      resolution_note = 'Superseded by a newer escalation'
  where intake_id = p_intake_id and resolved_at is null;

  insert into public.whatsapp_business_intake_escalations(
    intake_id, escalation_reason, severity, from_owner_user_id,
    to_owner_user_id, escalated_by_user_id
  ) values (
    p_intake_id, btrim(p_reason), p_severity, v_from_owner,
    p_to_owner_user_id, v_actor
  ) returning id into v_escalation_id;

  update public.whatsapp_business_intakes
  set escalation_owner_user_id = p_to_owner_user_id,
      assigned_user_id = p_to_owner_user_id,
      next_action = 'Supervisor review: ' || btrim(p_reason)
  where id = p_intake_id;

  insert into public.whatsapp_business_intake_audit_log(intake_id, event_type, actor_user_id, event_data)
  values (p_intake_id, 'ESCALATED', v_actor, jsonb_build_object(
    'escalation_id', v_escalation_id,
    'from_owner_user_id', v_from_owner,
    'to_owner_user_id', p_to_owner_user_id,
    'severity', p_severity,
    'reason', btrim(p_reason)
  ));

  return v_escalation_id;
end;
$$;

revoke all on function public.escalate_whatsapp_business_intake(uuid,uuid,text,text) from public, anon;
grant execute on function public.escalate_whatsapp_business_intake(uuid,uuid,text,text) to authenticated;

create table public.whatsapp_shift_reconciliations (
  id uuid primary key default gen_random_uuid(),
  shift_key text not null unique check (nullif(btrim(shift_key), '') is not null),
  shift_started_at timestamptz not null,
  shift_ended_at timestamptz not null check (shift_ended_at > shift_started_at),
  prepared_by_user_id uuid not null references public.users(id) on delete restrict,
  prepared_at timestamptz not null default now(),
  potential_received bigint not null check (potential_received >= 0),
  converted bigint not null check (converted >= 0),
  active_pending bigint not null check (active_pending >= 0),
  explicitly_closed bigint not null check (explicitly_closed >= 0),
  unaccounted_potential_orders bigint not null check (unaccounted_potential_orders >= 0),
  open_escalations bigint not null check (open_escalations >= 0),
  signoff_status text not null default 'PENDING' check (signoff_status in ('PENDING','SIGNED_OFF','REJECTED')),
  supervisor_user_id uuid null references public.users(id) on delete restrict,
  supervisor_note text null,
  signed_off_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint whatsapp_shift_equation check (
    potential_received = converted + active_pending + explicitly_closed
  ),
  constraint whatsapp_shift_signoff_evidence check (
    (signoff_status = 'PENDING' and supervisor_user_id is null and signed_off_at is null) or
    (signoff_status in ('SIGNED_OFF','REJECTED') and supervisor_user_id is not null and signed_off_at is not null and nullif(btrim(supervisor_note), '') is not null)
  ),
  constraint whatsapp_shift_clean_signoff check (
    signoff_status <> 'SIGNED_OFF' or (unaccounted_potential_orders = 0 and open_escalations = 0)
  )
);

alter table public.whatsapp_shift_reconciliations enable row level security;
create policy whatsapp_shift_reconciliation_reader_select
on public.whatsapp_shift_reconciliations for select to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));
create policy whatsapp_shift_reconciliation_reader_insert
on public.whatsapp_shift_reconciliations for insert to authenticated
with check (public.is_whatsapp_inbox_reader(auth.uid()));
create policy whatsapp_shift_reconciliation_reader_update
on public.whatsapp_shift_reconciliations for update to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()))
with check (public.is_whatsapp_inbox_reader(auth.uid()));

create or replace view public.whatsapp_shift_reconciliation_readiness
with (security_invoker = true)
as
select
  r.potential_received,
  r.converted,
  r.active_pending,
  r.explicitly_closed,
  r.unaccounted_potential_orders,
  count(e.id) filter (where e.resolved_at is null)::bigint as open_escalations,
  (r.unaccounted_potential_orders = 0 and count(e.id) filter (where e.resolved_at is null) = 0) as ready_for_signoff
from public.whatsapp_business_intake_reconciliation r
left join public.whatsapp_business_intake_escalations e on true
group by r.potential_received, r.converted, r.active_pending, r.explicitly_closed, r.unaccounted_potential_orders;

revoke all on public.whatsapp_shift_reconciliation_readiness from public, anon;
grant select on public.whatsapp_shift_reconciliation_readiness to authenticated;

comment on table public.whatsapp_business_intake_escalations is
  'Governed, auditable escalation and ownership-transfer ledger for active WhatsApp B2B intakes.';
comment on table public.whatsapp_shift_reconciliations is
  'Shift-level zero-loss snapshot requiring clean accounting and no open escalations before supervisor sign-off.';