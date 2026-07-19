\echo 'Issue #232 zero-loss UAT preflight (read-only)'

begin read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';

do $$
declare
  missing text;
begin
  with expected_objects(object_name, object_kind) as (
    values
      ('public.whatsapp_business_intakes', 'relation'),
      ('public.whatsapp_business_intake_audit', 'relation'),
      ('public.whatsapp_business_intake_reconciliation', 'relation'),
      ('public.whatsapp_business_intake_reconciliation_exceptions', 'relation'),
      ('public.whatsapp_business_intake_reconciliation_control', 'relation'),
      ('public.whatsapp_shift_reconciliation_readiness', 'relation'),
      ('public.whatsapp_operator_cockpit', 'relation'),
      ('public.whatsapp_manager_drilldown', 'relation'),
      ('public.transition_whatsapp_business_intake', 'function'),
      ('public.escalate_whatsapp_business_intake', 'function'),
      ('public.prepare_whatsapp_shift_reconciliation', 'function'),
      ('public.signoff_whatsapp_shift_reconciliation', 'function')
  )
  select string_agg(e.object_name, ', ' order by e.object_name)
    into missing
  from expected_objects e
  where case e.object_kind
    when 'relation' then to_regclass(e.object_name) is null
    when 'function' then not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = split_part(e.object_name, '.', 1)
        and p.proname = split_part(e.object_name, '.', 2)
    )
    else true
  end;

  if missing is not null then
    raise exception 'Issue 232 UAT preflight missing required objects: %', missing;
  end if;
end;
$$;

do $$
declare
  rls_enabled boolean;
  direct_update_policy_count integer;
begin
  select c.relrowsecurity
    into rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'whatsapp_business_intakes';

  if coalesce(rls_enabled, false) is not true then
    raise exception 'public.whatsapp_business_intakes must have RLS enabled';
  end if;

  select count(*)
    into direct_update_policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename = 'whatsapp_business_intakes'
    and cmd in ('UPDATE', 'ALL');

  if direct_update_policy_count > 0 then
    raise exception 'HIGH: direct UPDATE/ALL RLS policy exists on public.whatsapp_business_intakes; governed transition bypass remains possible';
  end if;
end;
$$;

do $$
declare
  unaccounted bigint;
begin
  select coalesce(sum(potential_received - converted - active_pending - explicitly_closed), 0)
    into unaccounted
  from public.whatsapp_business_intake_reconciliation;

  if unaccounted <> 0 then
    raise exception 'Issue 232 invariant failed: unaccounted potential orders = %', unaccounted;
  end if;
end;
$$;

select
  'PASS' as status,
  current_database() as database_name,
  now() as checked_at,
  0::bigint as unaccounted_potential_orders;

rollback;
