import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
const uatPath = path.resolve(process.cwd(), 'docs/WHATSAPP_ZERO_LOSS_FINAL_UAT.md');

function readMigration(fragment: string): string {
  const matches = fs.readdirSync(migrationsDir).filter((name) => name.includes(fragment));
  expect(matches, `migration containing ${fragment}`).toHaveLength(1);
  return fs.readFileSync(path.join(migrationsDir, matches[0]), 'utf8').toLowerCase();
}

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/"([^"]+)"/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function objectDefinition(sql: string, kind: 'view' | 'function', name: string): string {
  const normalized = stripSqlComments(sql);
  const start = normalized.indexOf(`create or replace ${kind} public.${name}`);
  expect(start, `${kind} public.${name} definition`).toBeGreaterThanOrEqual(0);

  const nextObject = normalized.indexOf(' create or replace ', start + 1);
  return normalized.slice(start, nextObject === -1 ? normalized.length : nextObject);
}

describe('WhatsApp zero-loss final hardening', () => {
  const intake = readMigration('wa_zero_loss_intake_foundation');
  const reconciliation = readMigration('wa_zero_loss_reconciliation_exceptions');
  const escalation = readMigration('wa_escalation_and_shift_reconciliation');
  const cockpit = readMigration('wa_operator_cockpit_manager_drilldown');
  const uat = fs.readFileSync(uatPath, 'utf8').toLowerCase();

  it('implements canonical accounting and explicit reconciliation exceptions', () => {
    const accountingView = objectDefinition(intake, 'view', 'whatsapp_business_intake_reconciliation');
    expect(accountingView).toContain("count(*)::bigint as potential_received");
    expect(accountingView).toContain("count(*) filter (where disposition = 'converted')::bigint as converted");
    expect(accountingView).toContain("count(*) filter (where disposition = 'active_pending')::bigint as active_pending");
    expect(accountingView).toContain("count(*) filter (where disposition = 'explicitly_closed')::bigint as explicitly_closed");
    expect(accountingView).toContain("from public.whatsapp_business_intakes");

    const exceptionView = objectDefinition(
      reconciliation,
      'view',
      'whatsapp_business_intake_reconciliation_exceptions',
    );
    expect(exceptionView).toContain('illegal_terminal_state_pending');
    expect(exceptionView).toContain('converted_state_mismatch');
    expect(exceptionView).toContain('closed_state_mismatch');
  });

  it('closes superseded escalations and enforces clean shift sign-off in the intended functions', () => {
    const escalateFunction = objectDefinition(escalation, 'function', 'escalate_whatsapp_business_intake');
    expect(escalateFunction).toMatch(/update public\.whatsapp_business_intake_escalations[\s\S]*set resolved_at = now\(\)/);
    expect(escalateFunction).toContain("resolution_note = 'superseded by a newer escalation'");
    expect(escalateFunction).toContain('where intake_id = p_intake_id');
    expect(escalateFunction).toContain('and resolved_at is null');

    const signoffFunction = objectDefinition(escalation, 'function', 'signoff_whatsapp_shift_reconciliation');
    expect(signoffFunction).toContain('potential_received = converted + active_pending + explicitly_closed');
    expect(signoffFunction).toContain('unaccounted_potential_orders = 0');
    expect(signoffFunction).toContain('open_escalations = 0');
    expect(signoffFunction).toContain('shift is not clean for sign-off');
    expect(signoffFunction).toContain('preparer cannot self-certify shift reconciliation');
  });

  it('binds every exposed read object to security-invoker and inbox-reader authorization', () => {
    const intakePolicy = stripSqlComments(intake);
    expect(intakePolicy).toMatch(
      /create policy whatsapp_business_intakes_inbox_reader_select[\s\S]{0,240}?using \(public\.is_whatsapp_inbox_reader\(auth\.uid\(\)\)\)/,
    );

    const exposedViews = [
      objectDefinition(intake, 'view', 'whatsapp_business_intake_reconciliation'),
      objectDefinition(reconciliation, 'view', 'whatsapp_business_intake_reconciliation_exceptions'),
      objectDefinition(reconciliation, 'view', 'whatsapp_business_intake_reconciliation_control'),
      objectDefinition(reconciliation, 'view', 'whatsapp_shift_reconciliation_readiness'),
      objectDefinition(cockpit, 'view', 'whatsapp_operator_cockpit'),
      objectDefinition(cockpit, 'view', 'whatsapp_manager_drilldown'),
    ];

    for (const view of exposedViews) {
      expect(view).toContain('with (security_invoker = true)');
      expect(view).not.toContain('security definer');
    }

    const exposedFunctions = [
      objectDefinition(intake, 'function', 'get_whatsapp_business_intake_reconciliation'),
      objectDefinition(reconciliation, 'function', 'get_whatsapp_business_intake_reconciliation_exceptions'),
      objectDefinition(cockpit, 'function', 'get_whatsapp_operator_cockpit'),
      objectDefinition(cockpit, 'function', 'get_whatsapp_manager_drilldown'),
    ];

    for (const fn of exposedFunctions) {
      expect(fn).toContain('security invoker');
      expect(fn).not.toContain('security definer');
    }

    const cockpitFunction = exposedFunctions[2];
    expect(cockpitFunction).toContain('public.is_whatsapp_inbox_reader(auth.uid())');
    expect(cockpitFunction).toContain('order by c.priority_rank, c.sla_due_at nulls last, c.created_at');
  });

  it('rejects direct and indirect protected downstream write spellings and requires executable snapshots', () => {
    const protectedRelations = '(orders|order_items|payments|invoices|inventory|dispatch|customers|products)';
    const normalized = stripSqlComments([intake, reconciliation, escalation, cockpit].join('\n'));
    const writePatterns = [
      new RegExp(`insert\\s+into\\s+(?:only\\s+)?public\\.${protectedRelations}\\b`, 'i'),
      new RegExp(`update\\s+(?:only\\s+)?public\\.${protectedRelations}\\b`, 'i'),
      new RegExp(`delete\\s+from\\s+(?:only\\s+)?public\\.${protectedRelations}\\b`, 'i'),
      new RegExp(`merge\\s+into\\s+(?:only\\s+)?public\\.${protectedRelations}\\b`, 'i'),
      new RegExp(`truncate(?:\\s+table)?\\s+(?:only\\s+)?public\\.${protectedRelations}\\b`, 'i'),
      new RegExp(`copy\\s+public\\.${protectedRelations}\\b[\\s\\S]*\\sfrom\\s`, 'i'),
      new RegExp(`execute[\\s\\S]{0,240}(insert|update|delete|merge|truncate|copy)[\\s\\S]{0,240}public\\.${protectedRelations}\\b`, 'i'),
    ];

    for (const pattern of writePatterns) {
      expect(normalized).not.toMatch(pattern);
    }

    for (const relation of ['orders', 'order_items', 'payments', 'invoices', 'inventory', 'dispatch', 'customers', 'products']) {
      expect(uat).toContain(`('${relation}', 'public.${relation}'::regclass)`);
    }
    expect(uat).toContain('protected_relation_fingerprint');
    expect(uat).toContain('n_tup_ins');
    expect(uat).toContain('n_tup_upd');
    expect(uat).toContain('n_tup_del');
    expect(uat).toContain('before and after every scenario');
  });
});
