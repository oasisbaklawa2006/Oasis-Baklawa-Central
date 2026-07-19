import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');

function readMigration(fragment: string): string {
  const file = fs.readdirSync(migrationsDir).find((name) => name.includes(fragment));
  expect(file, `migration containing ${fragment}`).toBeTruthy();
  return fs.readFileSync(path.join(migrationsDir, file!), 'utf8');
}

describe('WhatsApp zero-loss final hardening', () => {
  const intake = readMigration('wa_zero_loss_intake_foundation');
  const reconciliation = readMigration('wa_zero_loss_reconciliation_exceptions');
  const escalation = readMigration('wa_escalation_and_shift_reconciliation');
  const cockpit = readMigration('wa_operator_cockpit_manager_drilldown');

  it('preserves the canonical accounting equation', () => {
    expect(intake).toMatch(/potential_received/i);
    expect(intake).toMatch(/converted/i);
    expect(intake).toMatch(/active_pending/i);
    expect(intake).toMatch(/explicitly_closed/i);
    expect(escalation).toMatch(/unaccounted/i);
  });

  it('prevents silent terminal states and clean sign-off with unresolved work', () => {
    expect(reconciliation).toMatch(/CONTROL_GAP|control_gap/);
    expect(escalation).toMatch(/open escalation|open_escalation/i);
    expect(escalation).toMatch(/SIGNED_OFF/);
    expect(escalation).toMatch(/raise exception/i);
  });

  it('keeps escalation ownership governed', () => {
    expect(escalation).toMatch(/is_whatsapp_inbox_reader\s*\(\s*p_to_owner_user_id\s*\)/i);
    expect(escalation).toMatch(/from_owner_user_id/i);
    expect(escalation).toMatch(/to_owner_user_id/i);
    expect(escalation).toMatch(/resolved_at/i);
  });

  it('exposes deterministic operator and manager visibility without operational writes', () => {
    expect(cockpit).toMatch(/ACTIVE_PENDING/);
    expect(cockpit).toMatch(/priority/i);
    expect(cockpit).toMatch(/overdue/i);
    expect(cockpit).toMatch(/due_soon|due soon/i);
    expect(cockpit).toMatch(/security_invoker|security invoker/i);
    expect(cockpit).not.toMatch(/update\s+public\.(orders|order_items|payments|inventory|dispatch)/i);
    expect(cockpit).not.toMatch(/insert\s+into\s+public\.(orders|order_items|payments|inventory|dispatch)/i);
  });

  it('keeps reconciliation and cockpit read paths RLS-aware', () => {
    expect(reconciliation).toMatch(/security_invoker|security invoker/i);
    expect(cockpit).toMatch(/security_invoker|security invoker/i);
    expect(cockpit).not.toMatch(/security\s+definer/i);
  });
});