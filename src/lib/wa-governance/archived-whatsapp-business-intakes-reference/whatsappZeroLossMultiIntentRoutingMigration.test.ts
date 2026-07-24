import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719080000_wa_zero_loss_multi_intent_routing.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp zero-loss multi-intent routing", () => {
  it("persists multiple independently actionable intent types with durable evidence", () => {
    expect(sql).toContain("create table public.whatsapp_business_intake_intents");
    expect(sql).toContain("unique (intake_id, routing_key)");
    expect(sql).toContain("'new_order'");
    expect(sql).toContain("'order_modification'");
    expect(sql).toContain("'order_cancellation'");
    expect(sql).toContain("'price_enquiry'");
    expect(sql).toContain("'payment_information'");
    expect(sql).toContain("'dispatch_status'");
    expect(sql).toContain("'complaint'");
    expect(sql).toContain("'catalogue_request'");
    expect(sql).toContain("source_evidence <> '{}'::jsonb");
  });

  it("requires ownership, next action, due time, and explicit terminal shapes", () => {
    expect(sql).toContain("whatsapp_business_intake_intent_owner_required");
    expect(sql).toContain("whatsapp_business_intake_intent_terminal_shape");
    expect(sql).toContain("next_action text not null");
    expect(sql).toContain("due_at timestamptz not null");
    expect(sql).toContain("status in ('open', 'resolved', 'explicitly_closed')");
  });

  it("routes with authorization, parent locking, idempotency, and audit evidence", () => {
    expect(sql).toContain("route_whatsapp_business_intake_intent");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("security definer");
    expect(sql).toContain("for update");
    expect(sql).toContain("routing key already identifies a different business intent");
    expect(sql).toContain("business_intent_routed");
    expect(sql).toContain("none may remain unowned or silently terminal");
  });

  it("preserves clarification-led parent work while combining SLA deadlines", () => {
    expect(sql).toContain("from public.whatsapp_business_intake_clarifications");
    expect(sql).toContain("open_clarification_count > 0 then intake_row.next_action");
    expect(sql).toContain(
      "least(intake_row.sla_due_at, p_due_at, open_clarification_due_at)",
    );
  });

  it("denies direct mutation and contains no downstream truth writes", () => {
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_business_intake_intents from authenticated",
    );
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
