import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719084100_wa_contextual_alias_parent_reconciliation.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp contextual alias parent reconciliation", () => {
  it("recomputes parent work across aliases, routed intents, and clarifications", () => {
    expect(sql).toContain("remaining_governed_work_count");
    expect(sql).toContain("from public.whatsapp_contextual_aliases");
    expect(sql).toContain("from public.whatsapp_business_intake_intents");
    expect(sql).toContain("from public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("min(due_at)");
    expect(sql).toContain("p_target_status is null");
    expect(sql).toContain("open_clarification_count > 0 then intake_row.next_action");
    expect(sql).toContain(
      "continue every remaining governed intake work item; none may be silently lost.",
    );
  });

  it("retains authorization, lock order, terminal replay denial, and audit evidence", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    const parentLock = sql.indexOf("from public.whatsapp_business_intakes");
    const aliasLock = sql.indexOf("from public.whatsapp_contextual_aliases", parentLock);
    expect(parentLock).toBeGreaterThan(-1);
    expect(aliasLock).toBeGreaterThan(parentLock);
    expect(sql).toContain("contextual alias is already terminal");
    expect(sql).toContain("remaining_pending_alias_count");
    expect(sql).toContain("remaining_governed_work_count");
  });

  it("contains no downstream or master truth writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
