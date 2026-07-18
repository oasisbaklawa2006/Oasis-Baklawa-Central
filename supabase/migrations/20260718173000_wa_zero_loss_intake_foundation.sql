-- WhatsApp B2B zero-loss intake foundation.
-- Canonical authority:
--   docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md
--   docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md
-- Authority merged to main by commit 68d53e2c1ff672e0b55166e727edf4f0cb6e1cf1 (PR #233).
-- Canonical invariant: received = converted + actively pending + explicitly closed.

create table public.whatsapp_business_intakes (
  id uuid primary key default gen_random_uuid(),
  business_domain text not null default 'B2B' check (business_domain = 'B2B'),
  packet_id uuid null references public.whatsapp_message_packets(id) on delete restrict,
  source_message_id uuid null references public.whatsapp_messages(id) on delete restrict,
  provider_message_id text null,
  intake_kind text not null default 'UNRESOLVED_RISK' check (
    intake_kind in ('ORDER','POTENTIAL_ORDER','UNRESOLVED_RISK','NON_ORDER_BUSINESS')
  ),
  lifecycle_state text not null default 'RECEIVED' check (
    lifecycle_state in (
      'RECEIVED',
      'AWAITING_CLASSIFICATION',
      'AWAITING_CUSTOMER',
      'AWAITING_PRODUCT',
      'AWAITING_QUANTITY',
      'AWAITING_OTHER_CLARIFICATION',
      'READY_FOR_OPERATOR_REVIEW',
      'SALES_ORDER_DRAFT_CREATED',
      'CONVERTED_TO_SO',
      'EXPLICITLY_CLOSED'
    )
  ),
  disposition text not null default 'ACTIVE_PENDING' check (
    disposition in ('ACTIVE_PENDING','CONVERTED','EXPLICITLY_CLOSED')
  ),
  assigned_user_id uuid null references public.users(id) on delete set null,
  assigned_team text null,
  escalation_owner_user_id uuid null references public.users(id) on delete set null,
  next_action text null,
  sla_due_at timestamptz null,
  sales_order_draft_id uuid null references public.sales_order_drafts(id) on delete set null,
  sales_order_id uuid null references public.orders(id) on delete set null,
  closure_reason text null,
  closed_by_user_id uuid null references public.users(id) on delete restrict,
  closed_at timestamptz null,
  reconciliation_status text not null default 'ACCOUNTED' check (
    reconciliation_status in ('ACCOUNTED','UNACCOUNTED')
  ),
  reconciliation_issue text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_business_intakes_source_present check (
    packet_id is not null or source_message_id is not null or provider_message_id is not null
  ),
  constraint whatsapp_business_intakes_owner_present check (
    assigned_user_id is not null or assigned_team is not null or escalation_owner_user_id is not null
  ),
  constraint whatsapp_business_intakes_pending_next_action check (
    disposition <> 'ACTIVE_PENDING' or next_action is not null
  ),
  constraint whatsapp_business_intakes_converted_link check (
    disposition <> 'CONVERTED' or sales_order_draft_id is not null or sales_order_id is not null
  ),
  constraint whatsapp_business_intakes_closed_fields check (
    disposition <> 'EXPLICITLY_CLOSED' or (
      closure_reason is not null and
      closed_by_user_id is not null and
      closed_at is not null
    )
  ),
  constraint whatsapp_business_intakes_state_disposition_match check (
    (lifecycle_state = 'CONVERTED_TO_SO' and disposition = 'CONVERTED') or
    (lifecycle_state = 'EXPLICITLY_CLOSED' and disposition = 'EXPLICITLY_CLOSED') or
    (lifecycle_state not in ('CONVERTED_TO_SO','EXPLICITLY_CLOSED') and disposition = 'ACTIVE_PENDING')
  ),
  constraint whatsapp_business_intakes_reconciliation_issue_match check (
    (reconciliation_status = 'ACCOUNTED' and reconciliation_issue is null) or
    (reconciliation_status = 'UNACCOUNTED' and nullif(btrim(reconciliation_issue), '') is not null)
  )
);

create unique index whatsapp_business_intakes_packet_unique
  on public.whatsapp_business_intakes(packet_id)
  where packet_id is not null;

create unique index whatsapp_business_intakes_provider_message_unique
  on public.whatsapp_business_intakes(provider_message_id)
  where provider_message_id is not null;

create index whatsapp_business_intakes_active_queue_idx
  on public.whatsapp_business_intakes(disposition, lifecycle_state, sla_due_at);

create index whatsapp_business_intakes_owner_idx
  on public.whatsapp_business_intakes(assigned_user_id, assigned_team, escalation_owner_user_id);

create index whatsapp_business_intakes_reconciliation_idx
  on public.whatsapp_business_intakes(reconciliation_status, disposition, lifecycle_state);

create or replace function public.set_whatsapp_business_intake_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_whatsapp_business_intakes_updated_at on public.whatsapp_business_intakes;
create trigger trg_whatsapp_business_intakes_updated_at
before update on public.whatsapp_business_intakes
for each row execute function public.set_whatsapp_business_intake_updated_at();

create table public.whatsapp_business_intake_audit_log (
  id uuid primary key default gen_random_uuid(),
  intake_id uuid not null references public.whatsapp_business_intakes(id) on delete restrict,
  event_type text not null,
  actor_user_id uuid null references public.users(id) on delete set null,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index whatsapp_business_intake_audit_log_intake_idx
  on public.whatsapp_business_intake_audit_log(intake_id, created_at);

create or replace function public.prevent_whatsapp_business_intake_audit_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'whatsapp_business_intake_audit_log is append-only';
end;
$$;

drop trigger if exists trg_whatsapp_business_intake_audit_no_update on public.whatsapp_business_intake_audit_log;
create trigger trg_whatsapp_business_intake_audit_no_update
before update or delete on public.whatsapp_business_intake_audit_log
for each row execute function public.prevent_whatsapp_business_intake_audit_mutation();

alter table public.whatsapp_business_intakes enable row level security;
alter table public.whatsapp_business_intake_audit_log enable row level security;

drop policy if exists whatsapp_business_intakes_inbox_reader_select on public.whatsapp_business_intakes;
create policy whatsapp_business_intakes_inbox_reader_select
on public.whatsapp_business_intakes
for select
to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

drop policy if exists whatsapp_business_intakes_inbox_reader_insert on public.whatsapp_business_intakes;
create policy whatsapp_business_intakes_inbox_reader_insert
on public.whatsapp_business_intakes
for insert
to authenticated
with check (public.is_whatsapp_inbox_reader(auth.uid()));

drop policy if exists whatsapp_business_intakes_inbox_reader_update on public.whatsapp_business_intakes;
create policy whatsapp_business_intakes_inbox_reader_update
on public.whatsapp_business_intakes
for update
to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()))
with check (public.is_whatsapp_inbox_reader(auth.uid()));

drop policy if exists whatsapp_business_intake_audit_inbox_reader_select on public.whatsapp_business_intake_audit_log;
create policy whatsapp_business_intake_audit_inbox_reader_select
on public.whatsapp_business_intake_audit_log
for select
to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

drop policy if exists whatsapp_business_intake_audit_inbox_reader_insert on public.whatsapp_business_intake_audit_log;
create policy whatsapp_business_intake_audit_inbox_reader_insert
on public.whatsapp_business_intake_audit_log
for insert
to authenticated
with check (public.is_whatsapp_inbox_reader(auth.uid()));

create or replace view public.whatsapp_business_intake_reconciliation
with (security_invoker = true)
as
select
  count(*)::bigint as potential_received,
  count(*) filter (where disposition = 'CONVERTED')::bigint as converted,
  count(*) filter (where disposition = 'ACTIVE_PENDING')::bigint as active_pending,
  count(*) filter (where disposition = 'EXPLICITLY_CLOSED')::bigint as explicitly_closed,
  count(*) filter (where reconciliation_status = 'UNACCOUNTED')::bigint as unaccounted_potential_orders
from public.whatsapp_business_intakes
where intake_kind in ('ORDER','POTENTIAL_ORDER','UNRESOLVED_RISK');

grant select on public.whatsapp_business_intake_reconciliation to authenticated;

create or replace function public.get_whatsapp_business_intake_reconciliation()
returns table (
  potential_received bigint,
  converted bigint,
  active_pending bigint,
  explicitly_closed bigint,
  unaccounted_potential_orders bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    potential_received,
    converted,
    active_pending,
    explicitly_closed,
    unaccounted_potential_orders
  from public.whatsapp_business_intake_reconciliation;
$$;

grant execute on function public.get_whatsapp_business_intake_reconciliation() to authenticated;

comment on table public.whatsapp_business_intakes is
  'Authoritative B2B WhatsApp intake ledger governed by docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md. Every order-like or unresolved-risk intake must remain converted, actively pending, or explicitly closed.';
comment on column public.whatsapp_business_intakes.reconciliation_status is
  'Explicit control state. UNACCOUNTED requires a non-empty reconciliation_issue and must remain visible until repaired.';
comment on view public.whatsapp_business_intake_reconciliation is
  'Zero-loss control: potential_received = converted + active_pending + explicitly_closed; unaccounted_potential_orders counts explicit reconciliation breaches and must be zero.';
