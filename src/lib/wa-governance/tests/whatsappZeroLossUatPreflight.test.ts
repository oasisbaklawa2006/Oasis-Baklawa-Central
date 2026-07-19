import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const runnerPath = path.resolve(process.cwd(), 'scripts/run-wa-zero-loss-uat-preflight.sh');
const sqlPath = path.resolve(process.cwd(), 'supabase/uat/wa_zero_loss_issue_232_preflight.sql');

const runner = fs.readFileSync(runnerPath, 'utf8');
const sql = fs.readFileSync(sqlPath, 'utf8').toLowerCase();

describe('Issue 232 zero-loss UAT preflight', () => {
  it('fails closed unless an isolated read-only execution is explicitly confirmed', () => {
    expect(runner).toContain('UAT_DATABASE_URL');
    expect(runner).toContain('UAT_DATABASE_CONFIRM=ISSUE_232_ISOLATED_READ_ONLY');
    expect(runner).toContain('tcxvcatsqqertcnycuop');
    expect(runner).toContain('--set=ON_ERROR_STOP=1');
    expect(runner).toContain('--no-psqlrc');
  });

  it('runs the database contract inside a read-only transaction with bounded waits', () => {
    expect(sql).toContain('begin read only');
    expect(sql).toContain("set local statement_timeout = '30s'");
    expect(sql).toContain("set local lock_timeout = '3s'");
    expect(sql).toContain('rollback;');
    expect(sql).not.toMatch(/\b(insert|update|delete|merge|truncate|copy)\s+(into\s+|from\s+)?public\./);
  });

  it('fails when required control-plane objects, rls, or the zero-loss equation are absent', () => {
    for (const objectName of [
      'public.whatsapp_business_intakes',
      'public.whatsapp_business_intake_audit',
      'public.whatsapp_business_intake_reconciliation',
      'public.whatsapp_business_intake_reconciliation_exceptions',
      'public.whatsapp_shift_reconciliation_readiness',
      'public.whatsapp_operator_cockpit',
      'public.whatsapp_manager_drilldown',
      'public.transition_whatsapp_business_intake',
      'public.escalate_whatsapp_business_intake',
      'public.prepare_whatsapp_shift_reconciliation',
      'public.signoff_whatsapp_shift_reconciliation',
    ]) {
      expect(sql).toContain(objectName);
    }

    expect(sql).toContain('relrowsecurity');
    expect(sql).toContain("cmd in ('update', 'all')");
    expect(sql).toContain('potential_received - converted - active_pending - explicitly_closed');
    expect(sql).toContain('unaccounted potential orders');
  });
});
