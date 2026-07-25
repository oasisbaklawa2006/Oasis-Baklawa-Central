import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719062500_wa_zero_loss_clarification_due_time_required.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp formal clarification due-time hardening", () => {
  it("backfills legacy nulls before requiring due time at schema and RPC boundaries", () => {
    expect(sql).toContain("set due_at = coalesce(created_at, now()) + interval '4 hours'");
    expect(sql).toContain("where due_at is null");
    expect(sql.indexOf("where due_at is null")).toBeLessThan(
      sql.indexOf("alter column due_at set not null"),
    );
    expect(sql).toContain("if p_due_at is null then");
    expect(sql).toContain("clarification due time is required");
  });

  it("preserves authorization, ownership, row locking, and governed next action", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("for update");
    expect(sql).toContain("clarification work must retain an owner");
    expect(sql).toContain("next_action = 'obtain clarification: '");
    expect(sql).toContain("'due_at', p_due_at");
  });

  it("contains no downstream truth writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
