import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719083000_wa_zero_loss_intent_lifecycle.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp routed intent governed lifecycle", () => {
  it("allows only explicit terminal outcomes with mandatory evidence", () => {
    expect(sql).toContain(
      "p_target_status is null or p_target_status not in ('resolved', 'explicitly_closed')",
    );
    expect(sql).toContain("non-empty outcome evidence is required");
    expect(sql).toContain("closure reason is required");
    expect(sql).toContain("routed whatsapp business intent is already terminal");
  });

  it("uses authorization and consistent parent-before-child row locking", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("security definer");
    const parentLock = sql.indexOf("from public.whatsapp_business_intakes");
    const childLock = sql.indexOf(
      "from public.whatsapp_business_intake_intents",
      parentLock,
    );
    expect(parentLock).toBeGreaterThan(-1);
    expect(childLock).toBeGreaterThan(parentLock);
    expect(sql.match(/for update/g) ?? []).toHaveLength(2);
  });

  it("recomputes remaining work and appends immutable audit evidence", () => {
    expect(sql).toContain("remaining_open_count");
    expect(sql).toContain("min(due_at)");
    expect(sql).toContain("business_intent_resolved");
    expect(sql).toContain("business_intent_explicitly_closed");
    expect(sql).toContain("remaining_open_intent_count");
    expect(sql).toContain("review completed routed intents and continue governed intake resolution.");
  });

  it("reconciles routed intents with simultaneous open clarification work", () => {
    expect(sql).toContain("from public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("open_clarification_count > 0 then intake_row.next_action");
    expect(sql).toContain(
      "combined_open_due_at := least(remaining_due_at, open_clarification_due_at)",
    );
    expect(sql).toContain("'open_clarification_count', open_clarification_count");
  });

  it("contains no downstream truth writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
