import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719040500_wa_zero_loss_identity_role_switching.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp identity role correction hardening", () => {
  it("explicitly replaces contact and internal-user identity types", () => {
    expect(sql).toContain("if p_submitting_sender_contact_id is not null then");
    expect(sql).toContain("effective_submitter_user_id := null");
    expect(sql).toContain("elsif p_submitting_sender_user_id is not null then");
    expect(sql).toContain("effective_submitter_contact_id := null");
    expect(sql).toContain("if p_original_communicator_contact_id is not null then");
    expect(sql).toContain("effective_original_user_id := null");
    expect(sql).toContain("elsif p_original_communicator_user_id is not null then");
    expect(sql).toContain("effective_original_contact_id := null");
  });

  it("retains row locking, authorization, terminal protection, and audit history", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("for update");
    expect(sql).toContain("terminal intake identity cannot be changed");
    expect(sql).toContain("previous_submitting_sender_contact_id");
    expect(sql).toContain("previous_original_communicator_contact_id");
    expect(sql).toContain("previous_commercial_customer_id");
    expect(sql).toContain("whatsapp_business_intake_audit_log");
  });

  it("contains no executable order, finance, dispatch, or inventory writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
