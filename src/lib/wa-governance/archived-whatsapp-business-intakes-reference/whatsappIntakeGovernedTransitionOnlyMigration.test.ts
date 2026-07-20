import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const migrationPath = path.resolve(
  process.cwd(),
  'supabase/migrations/20260719213000_wa_intake_governed_transition_only.sql',
);
const sql = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

describe('WhatsApp intake governed-transition-only migration', () => {
  it('removes the broad authenticated direct-update policy', () => {
    expect(sql).toContain(
      'drop policy if exists whatsapp_business_intakes_inbox_reader_update',
    );
    expect(sql).toContain('on public.whatsapp_business_intakes');
    expect(sql).not.toMatch(/create\s+policy[\s\S]*for\s+update/);
    expect(sql).not.toMatch(/create\s+policy[\s\S]*for\s+all/);
  });

  it('revokes table-level update from untrusted application roles', () => {
    expect(sql).toContain(
      'revoke update on table public.whatsapp_business_intakes from authenticated',
    );
    expect(sql).toContain(
      'revoke update on table public.whatsapp_business_intakes from anon',
    );
  });

  it('does not mutate intake data or protected downstream truth', () => {
    expect(sql).not.toMatch(/\b(update|insert\s+into|delete\s+from|truncate)\s+public\.whatsapp_business_intakes\b/);
    for (const relation of [
      'orders',
      'order_items',
      'finance',
      'dispatch',
      'inventory',
    ]) {
      expect(sql).not.toMatch(
        new RegExp(`\\b(update|insert\\s+into|delete\\s+from|truncate)\\s+public\\.${relation}\\b`),
      );
    }
  });

  it('is transactional and idempotent for policy removal', () => {
    expect(sql).toContain('begin;');
    expect(sql).toContain('commit;');
    expect(sql).toContain('drop policy if exists');
  });
});
