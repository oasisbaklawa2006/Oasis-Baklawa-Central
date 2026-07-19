import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719084200_wa_contextual_alias_reuse_audit.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp contextual alias reuse audit", () => {
  it("records every same-target reuse on the current intake", () => {
    expect(sql).toContain("contextual_alias_reused");
    expect(sql).toContain("contextual_alias_linked_pending");
    expect(sql).toContain("originating_intake_id");
    expect(sql).toContain("current_intake_evidence");
    expect(sql).toContain("p_intake_id,");
  });

  it("keeps conflicting targets rejected and linked pending work visible", () => {
    expect(sql).toContain("existing_row.target_entity_id <> p_target_entity_id");
    expect(sql).toContain("contextual alias already maps to a different target");
    expect(sql).toContain("track linked contextual alias review before any governed reuse.");
    expect(sql).toContain("least(coalesce(sla_due_at, existing_row.due_at), existing_row.due_at)");
    expect(sql).toContain("open_clarification_count > 0 then intake_row.next_action");
  });

  it("populates clarification state before preserving the existing next action", () => {
    expect(sql).toContain("select count(*) into open_clarification_count");
    expect(sql).toContain("from public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("and status = 'open'");
  });

  it("recovers same-target unique races without losing current-intake evidence", () => {
    expect(sql).toContain("when unique_violation then");
    expect(sql.match(/select \* into existing_row/g)).toHaveLength(2);
    expect(sql).toContain("if not found then\n      raise;");
    expect(sql).toContain("'race_recovered', true");
    expect(sql).toContain("return existing_row.id;");
  });

  it("retains authorization, parent locking, and no downstream truth writes", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("from public.whatsapp_business_intakes");
    expect(sql).toContain("for update");
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts|companies|products|catalogue_products)/);
  });
});
