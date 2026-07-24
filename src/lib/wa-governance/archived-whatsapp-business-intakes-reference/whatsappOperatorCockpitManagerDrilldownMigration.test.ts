import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719183000_wa_operator_cockpit_manager_drilldown.sql'),
  'utf8',
);

describe('WhatsApp operator cockpit and manager drill-down migration', () => {
  it('keeps both reporting surfaces security-invoker and read only', () => {
    expect(migration).toContain('create or replace view public.whatsapp_operator_cockpit');
    expect(migration).toContain('create or replace view public.whatsapp_manager_drilldown');
    expect(migration.match(/with \(security_invoker = true\)/g)).toHaveLength(2);
    expect(migration).not.toMatch(/insert into public\.(orders|order_items|payments|invoices|inventory)/i);
    expect(migration).not.toMatch(/update public\.(orders|order_items|payments|invoices|inventory)/i);
  });

  it('restricts the cockpit to active pending work', () => {
    expect(migration).toContain("where i.disposition = 'ACTIVE_PENDING'");
    expect(migration).toContain("when i.reconciliation_status = 'UNACCOUNTED' then 'CONTROL_GAP'");
    expect(migration).toContain("when i.sla_due_at is not null and i.sla_due_at < now() then 'OVERDUE'");
  });

  it('orders operator work deterministically by governed priority', () => {
    expect(migration).toContain('end as priority_rank');
    expect(migration).toContain('order by c.priority_rank, c.sla_due_at nulls last, c.created_at');
    expect(migration).toContain('limit greatest(1, least(coalesce(p_limit, 100), 500))');
  });

  it('preserves open escalation visibility without multiplying resolved history', () => {
    expect(migration.match(/e\.resolved_at is null/g)?.length).toBeGreaterThanOrEqual(2);
    expect(migration).toContain('e.acknowledged_at as escalation_acknowledged_at');
    expect(migration).toContain('unacknowledged_escalations');
  });

  it('provides manager drill-down by both team and operator', () => {
    expect(migration).toContain("coalesce(i.assigned_team, 'UNASSIGNED') as assigned_team");
    expect(migration).toContain('i.assigned_user_id');
    expect(migration).toContain("group by coalesce(i.assigned_team, 'UNASSIGNED'), i.assigned_user_id");
    expect(migration).toContain('control_gaps desc');
    expect(migration).toContain('overdue desc');
  });

  it('uses security-invoker functions and bounded query parameters', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain('p_assigned_user_id uuid default null');
    expect(migration).toContain('p_assigned_team text default null');
    expect(migration).toContain('grant execute on function public.get_whatsapp_operator_cockpit(uuid, text, integer) to authenticated');
    expect(migration).toContain('grant execute on function public.get_whatsapp_manager_drilldown() to authenticated');
  });
});
