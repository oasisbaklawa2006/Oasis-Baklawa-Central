import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719061000_wa_zero_loss_formal_clarifications.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp formal clarification workflow migration", () => {
  it("persists owned clarification work with explicit terminal shapes", () => {
    expect(sql).toContain("create table public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("clarification_type in ('classification', 'customer', 'product', 'quantity', 'other')");
    expect(sql).toContain("status in ('open', 'answered', 'cancelled')");
    expect(sql).toContain("whatsapp_intake_clarification_owner_required");
    expect(sql).toContain("whatsapp_intake_clarification_terminal_shape");
    expect(sql).toContain("where status = 'open'");
  });

  it("creates clarification work with authorization, row locking, ownership, and next action", () => {
    expect(sql).toContain("create_whatsapp_business_intake_clarification");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("for update");
    expect(sql).toContain("clarification work must retain an owner");
    expect(sql).toContain("terminal whatsapp business intake cannot receive clarification work");
    expect(sql).toContain("next_action = 'obtain clarification: '");
    expect(sql).toContain("clarification_requested");
  });

  it("answers only open work and requires evidence without prematurely marking readiness", () => {
    expect(sql).toContain("answer_whatsapp_business_intake_clarification");
    expect(sql).toContain("answer text and evidence are required");
    expect(sql).toContain("clarification is already terminal");
    expect(sql).toContain("review clarification response and continue governed resolution.");
    expect(sql).toContain("clarification_answered");
    expect(sql).not.toContain("set lifecycle_state = 'ready_for_operator_review'");
  });

  it("keeps direct writes unavailable and RPCs unavailable to public and anonymous roles", () => {
    expect(sql).toContain("revoke all on function public.create_whatsapp_business_intake_clarification");
    expect(sql).toContain("revoke all on function public.answer_whatsapp_business_intake_clarification");
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
