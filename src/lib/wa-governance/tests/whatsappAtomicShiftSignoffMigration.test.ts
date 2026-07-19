import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260719162500_wa_atomic_shift_signoff.sql'),
  'utf8',
);

function functionBody(sql: string): string {
  const match = sql.match(
    /create or replace function public\.signoff_whatsapp_shift_reconciliation[\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
  );
  expect(match, 'signoff function definition').toBeTruthy();
  return match![1];
}

describe('WhatsApp atomic shift sign-off migration', () => {
  const body = functionBody(migration);

  it('bounds lock acquisition transaction-locally before locking source tables', () => {
    const timeout = body.indexOf("perform set_config('lock_timeout', '5s', true)");
    const intakeLock = body.indexOf(
      'lock table public.whatsapp_business_intakes in share mode',
    );
    const escalationLock = body.indexOf(
      'lock table public.whatsapp_business_intake_escalations in share mode',
    );

    expect(timeout).toBeGreaterThanOrEqual(0);
    expect(intakeLock).toBeGreaterThan(timeout);
    expect(escalationLock).toBeGreaterThan(timeout);
  });

  it('locks both mutable source tables before reading reconciliation state', () => {
    const intakeLock = body.indexOf(
      'lock table public.whatsapp_business_intakes in share mode',
    );
    const escalationLock = body.indexOf(
      'lock table public.whatsapp_business_intake_escalations in share mode',
    );
    const reconciliationRead = body.indexOf(
      'from public.whatsapp_business_intake_reconciliation',
    );
    const escalationRead = body.indexOf(
      'from public.whatsapp_business_intake_escalations',
    );

    expect(intakeLock).toBeGreaterThanOrEqual(0);
    expect(escalationLock).toBeGreaterThanOrEqual(0);
    expect(reconciliationRead).toBeGreaterThan(intakeLock);
    expect(reconciliationRead).toBeGreaterThan(escalationLock);
    expect(escalationRead).toBeGreaterThan(intakeLock);
    expect(escalationRead).toBeGreaterThan(escalationLock);
  });

  it('keeps the clean-signoff guard ahead of the final update', () => {
    const guard = body.indexOf("raise exception 'shift is not clean for sign-off'");
    const update = body.indexOf('update public.whatsapp_shift_reconciliations');

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(update).toBeGreaterThan(guard);
  });

  it('preserves authorization and separation-of-duties checks', () => {
    expect(body).toContain('if not public.is_whatsapp_inbox_reader(v_actor) then');
    expect(body).toContain("raise exception 'preparer cannot self-certify shift reconciliation'");
  });
});
