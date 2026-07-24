import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719222500_wa_child_ledgers_governed_write_only.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

const governedLedgers = [
  'whatsapp_business_intake_clarifications',
  'whatsapp_business_intake_escalations',
  'whatsapp_shift_reconciliations',
];

describe('WhatsApp child ledgers governed-write-only migration', () => {
  it('revokes every direct mutation privilege from application roles', () => {
    for (const relation of governedLedgers) {
      expect(sql).toMatch(
        new RegExp(
          `revoke\\s+insert,\\s*update,\\s*delete,\\s*truncate\\s+on\\s+table\\s+public\\.${relation}\\s+from\\s+public,\\s*anon,\\s*authenticated`,
        ),
      );
    }
  });

  it('keeps the migration privilege-only and transaction bounded', () => {
    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).not.toMatch(/\b(insert\s+into|update|delete\s+from|truncate\s+table)\s+public\./);
    expect(sql).not.toMatch(/\b(create|drop|alter)\s+(table|policy|function|view)\b/);
  });

  it('does not touch protected downstream system-of-record relations', () => {
    for (const relation of [
      'orders',
      'order_items',
      'payments',
      'invoices',
      'inventory',
      'dispatch',
      'companies',
      'products',
    ]) {
      expect(sql).not.toMatch(
        new RegExp(
          `\\b(insert\\s+into|update|delete\\s+from|truncate\\s+table)\\s+public\\.${relation}\\b`,
        ),
      );
    }
  });

  it('documents function-only mutation without granting new privileges', () => {
    expect(sql.match(/function-only|governed rpcs/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
    expect(sql).not.toMatch(/\bgrant\s+(insert|update|delete|truncate|all)\b/);
  });
});
