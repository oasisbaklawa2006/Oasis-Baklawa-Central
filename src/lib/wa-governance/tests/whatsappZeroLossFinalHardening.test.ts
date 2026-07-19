import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

function readMigration(fragment: string): string {
  const matches = fs.readdirSync(migrationsDir).filter((name) => name.includes(fragment));
  expect(matches, `migration containing ${fragment}`).toHaveLength(1);
  return fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8');
}

describe('WhatsApp zero-loss final hardening', () => {
  const intake = readMigration('wa_zero_loss_intake_foundation');
  const reconciliation = readMigration('wa_zero_loss_reconciliation_exceptions');
  const escalation = readMigration('wa_escalation_and_shift_reconciliation');
  const cockpit = readMigration('wa_operator_cockpit_manager_drilldown');

  it('retains the canonical accounting and reconciliation controls', () => {
    expect(intake).toContain('potential_received');
    expect(intake).toContain('converted');
    expect(intake).toContain('active_pending');
    expect(intake).toContain('explicitly_closed');
    expect(reconciliation).toContain('ILLEGAL_TERMINAL_STATE_PENDING');
    expect(reconciliation).toContain('CONVERTED_STATE_MISMATCH');
    expect(reconciliation).toContain('CLOSED_STATE_MISMATCH');
  });

  it('retains governed escalation and shift sign-off controls', () => {
    expect(escalation).toContain('whatsapp_intake_escalations_one_open_per_intake');
    expect(escalation).toContain('Superseded by a newer escalation');
    expect(escalation).toContain('whatsapp_shift_separation_of_duties');
    expect(escalation).toContain('shift is not clean for sign-off');
  });

  it('retains deterministic, security-invoker cockpit visibility', () => {
    expect(cockpit).toContain('create or replace view public.whatsapp_operator_cockpit');
    expect(cockpit).toContain('create or replace view public.whatsapp_manager_drilldown');
    expect(cockpit.match(/with \(security_invoker = true\)/g)).toHaveLength(2);
    expect(cockpit).toContain("where i.disposition = 'ACTIVE_PENDING'");
    expect(cockpit).toContain('order by c.priority_rank, c.sla_due_at nulls last, c.created_at');
  });

  it('keeps exposed read paths RLS-aware', () => {
    expect(intake).toMatch(/alter table public\.whatsapp_business_intakes enable row level security/i);
    expect(reconciliation).toContain('with (security_invoker = true)');
    expect(cockpit).not.toMatch(/security\s+definer/i);
  });

  it('contains no protected downstream mutation path', () => {
    const protectedRelations = [
      'orders',
      'order_items',
      'payments',
      'invoices',
      'inventory',
      'dispatch',
      'customers',
      'products',
    ];
    const allControlPlaneSql = [intake, reconciliation, escalation, cockpit].join('\n');

    for (const relation of protectedRelations) {
      const mutation = new RegExp(
        `(?:insert\\s+into|update|delete\\s+from|merge\\s+into|truncate(?:\\s+table)?)\\s+public\\.${relation}\\b`,
        'i',
      );
      expect(allControlPlaneSql).not.toMatch(mutation);
    }
  });
});
