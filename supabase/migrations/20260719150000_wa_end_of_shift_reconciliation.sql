-- Governed end-of-shift reconciliation evidence for Issue #232.
-- Captures an immutable snapshot only; never mutates intake or operational truth.

create table public.whatsapp_business_intake_shift_reconciliations (
  id uuid primary key default gen_random_uuid(),
  shift_key text not null check (nullif(btrim(shift_key), '') is not null),
  reconciliation_status text not null check (
    reconciliation_status in ('CLEAN', 'EXCEPTIONS_PRESENT')
  ),
  potential_received bigint not null check (potential_received >= 0),
  converted bigint not null check (converted >= 0),
  active_pending bigint not null check (active_pending >= 0),
  explicitly_closed bigint not null check (explicitly_closed >= 0),
  unaccounted_potential_orders bigint not null check (unaccounted_potential_orders >= 0),
  derived_breach_intakes bigint not null check (derived_breach_intakes >= 0),
  overdue_intakes bigint not null check (overdue_intakes >= 0),
  control_gap_intakes bigint not null check (control_gap_intakes >= 0),
  total_exception_intakes bigint not null check (total_exception_intakes >= 0),
  reconciliation_note text null,
  recorded_by_user_id uuid not null references public.users(id) on delete restrict,
  recorded_at timestamptz not null default now(),
  constraint whatsapp_shift_reconciliation_equation check (
    potential_received = converted + active_pending + explicitly_closed
  ),
  constraint whatsapp_shift_reconciliation_status_match check (
    (reconciliation_status = 'CLEAN'
      and unaccounted_potential_orders = 0
      and total_exception_intakes = 0)
    or
    (reconciliation_status = 'EXCEPTIONS_PRESENT'
      and (unaccounted_potential_orders > 0 or total_exception_intakes > 0))
  )
);

create index whatsapp_shift_reconciliation_shift_idx
  on public.whatsapp_business_intake_shift_reconciliations(shift_key, recorded_at desc);

create index whatsapp_shift_reconciliation_status_idx
  on public.whatsapp_business_intake_shift_reconciliations(reconciliation_status, recorded_at desc);

create or replace function public.prevent_whatsapp_shift_reconciliation_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'whatsapp_business_intake_shift_reconciliations is append-only';
end;
$$;

create trigger trg_whatsapp_shift_reconciliation_no_mutation
before update or delete on public.whatsapp_business_intake_shift_reconciliations
for each row execute function public.prevent_whatsapp_shift_reconciliation_mutation();

alter table public.whatsapp_business_intake_shift_reconciliations enable row level security;

create policy whatsapp_shift_reconciliation_inbox_reader_select
on public.whatsapp_business_intake_shift_reconciliations
for select
to authenticated
using (public.is_whatsapp_inbox_reader(auth.uid()));

revoke all on public.whatsapp_business_intake_shift_reconciliations from public;
revoke all on public.whatsapp_business_intake_shift_reconciliations from anon;
revoke all on public.whatsapp_business_intake_shift_reconciliations from authenticated;
grant select on public.whatsapp_business_intake_shift_reconciliations to authenticated;

create or replace function public.capture_whatsapp_business_intake_shift_reconciliation(
  p_shift_key text,
  p_reconciliation_note text default null
)
returns public.whatsapp_business_intake_shift_reconciliations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor uuid := auth.uid();
  v_control public.whatsapp_business_intake_reconciliation_control%rowtype;
  v_result public.whatsapp_business_intake_shift_reconciliations%rowtype;
begin
  if v_actor is null or not public.is_whatsapp_inbox_reader(v_actor) then
    raise exception 'not authorized to capture WhatsApp shift reconciliation';
  end if;

  if nullif(btrim(p_shift_key), '') is null then
    raise exception 'shift key is required';
  end if;

  select *
  into strict v_control
  from public.whatsapp_business_intake_reconciliation_control;

  insert into public.whatsapp_business_intake_shift_reconciliations (
    shift_key,
    reconciliation_status,
    potential_received,
    converted,
    active_pending,
    explicitly_closed,
    unaccounted_potential_orders,
    derived_breach_intakes,
    overdue_intakes,
    control_gap_intakes,
    total_exception_intakes,
    reconciliation_note,
    recorded_by_user_id
  ) values (
    btrim(p_shift_key),
    case
      when v_control.unaccounted_potential_orders = 0
        and v_control.total_exception_intakes = 0
      then 'CLEAN'
      else 'EXCEPTIONS_PRESENT'
    end,
    v_control.potential_received,
    v_control.converted,
    v_control.active_pending,
    v_control.explicitly_closed,
    v_control.unaccounted_potential_orders,
    v_control.derived_breach_intakes,
    v_control.overdue_intakes,
    v_control.control_gap_intakes,
    v_control.total_exception_intakes,
    nullif(btrim(p_reconciliation_note), ''),
    v_actor
  )
  returning * into v_result;

  return v_result;
end;
$$;

revoke all on function public.capture_whatsapp_business_intake_shift_reconciliation(text, text) from public;
revoke all on function public.capture_whatsapp_business_intake_shift_reconciliation(text, text) from anon;
grant execute on function public.capture_whatsapp_business_intake_shift_reconciliation(text, text) to authenticated;

comment on table public.whatsapp_business_intake_shift_reconciliations is
  'Immutable end-of-shift snapshots proving whether the governed B2B WhatsApp intake equation and derived exception queue were clean when checked.';
comment on function public.capture_whatsapp_business_intake_shift_reconciliation(text, text) is
  'Authorized snapshot capture only; does not close, convert, reassign, or otherwise mutate WhatsApp intake or downstream operational truth.';
