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

  it('implements the canonical accounting equation', () => {
    expect(intake).toMatch(
      /potential_received\s*=\s*converted\s*\+\s*active_pending\s*\+\s*explicitly_closed/i,
    );
    expect(escalation).toMatch(
      /constraint\s+whatsapp_shift_equation[\s\S]*potential_received\s*=\s*converted\s*\+\s*active_pending\s*\+\s*explicitly_closed/i,
    );
  });

  it('prevents silent terminal states and clean sign-off with unresolved work', () => {
    expect(reconciliation).toMatch(/ILLEGAL_TERMINAL_STATE_PENDING/);
    expect(reconciliation).toMatch(/CONVERTED_STATE_MISMATCH/);
    expect(reconciliation).toMatch(/CLOSED_STATE_MISMATCH/);
    expect(escalation).toMatch(
      /constraint\s+whatsapp_shift_clean_signoff[\s\S]*signoff_status\s*<>\s*'SIGNED_OFF'[\s\S]*unaccounted_potential_orders\s*=\s*0[\s\S]*open_escalations\s*=\s*0/i,
    );
    expect(escalation).toMatch(/raise exception 'shift is not clean for sign-off'/i);
  });

  it('keeps escalation ownership and replacement governed', () => {
    expect(escalation).toMatch(
      /create unique index\s+whatsapp_intake_escalations_one_open_per_intake[\s\S]*where resolved_at is null/i,
    );
    expect(escalation).toMatch(/is_whatsapp_inbox_reader\s*\(\s*p_to_owner_user_id\s*\)/i);
    expect(escalation).toMatch(
      /update public\.whatsapp_business_intake_escalations[\s\S]*resolution_note\s*=\s*'Superseded by a newer escalation'[\s\S]*resolved_at is null/i,
    );
    expect(escalation).toMatch(
      /constraint\s+whatsapp_shift_separation_of_duties[\s\S]*supervisor_user_id\s*<>\s*prepared_by_user_id/i,
    );
  });

  it('exposes deterministic operator and manager visibility', () => {
    expect(cockpit).toMatch(
      /create or replace view public\.whatsapp_operator_cockpit\s+with \(security_invoker = true\)/i,
    );
    expect(cockpit).toMatch(/where i\.disposition = 'ACTIVE_PENDING'/i);
    expect(cockpit).toMatch(
      /order by c\.priority_rank, c\.sla_due_at nulls last, c\.created_at/i,
    );
    expect(cockpit).toMatch(
      /create or replace view public\.whatsapp_manager_drilldown\s+with \(security_invoker = true\)/i,
    );
    expect(cockpit).toMatch(/count\(\*\) filter \(where i\.reconciliation_status = 'UNACCOUNTED'\)/i);
    expect(cockpit).toMatch(/count\(\*\) filter \(where e\.id is not null\)/i);
  });

  it('keeps exposed read paths RLS-aware', () => {
    expect(intake).toMatch(/alter table public\.whatsapp_business_intakes enable row level security/i);
    expect(intake).toMatch(
      /create policy[\s\S]*on public\.whatsapp_business_intakes for select[\s\S]*is_whatsapp_inbox_reader\s*\(\s*auth\.uid\(\)\s*\)/i,
    );
    expect(reconciliation).toMatch(
      /create or replace view public\.whatsapp_business_intake_reconciliation_exceptions\s+with \(security_invoker = true\)/i,
    );
    expect(reconciliation).toMatch(
      /create or replace view public\.whatsapp_business_intake_reconciliation_control\s+with \(security_invoker = true\)/i,
    );
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