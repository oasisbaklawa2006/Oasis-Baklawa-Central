import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719062000_wa_zero_loss_formal_clarification_closure.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp formal clarification closure hardening", () => {
  it("enforces evidence only for answered clarifications", () => {
    expect(sql).toContain("whatsapp_intake_clarification_evidence_terminal_shape");
    expect(sql).toContain("status = 'answered' or answer_evidence is null");
    expect(sql).toContain("whatsapp_intake_clarification_answer_evidence_required");
    expect(sql).toContain("answer_evidence <> '{}'::jsonb");
    expect(sql).toContain("answer_evidence <> 'null'::jsonb");
  });

  it("denies direct table mutation to public-facing roles", () => {
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from public",
    );
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from anon",
    );
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_business_intake_clarifications from authenticated",
    );
  });

  it("cancels only open clarification work with reason, locking, and audit evidence", () => {
    expect(sql).toContain("cancel_whatsapp_business_intake_clarification");
    expect(sql).toContain("security definer");
    expect(sql).toContain("for update");
    expect(sql).toContain("clarification cancellation reason is required");
    expect(sql).toContain("clarification is already terminal");
    expect(sql).toContain("clarification_cancelled");
    expect(sql).toContain("review cancelled clarification and define the next governed action.");
  });

  it("contains no downstream truth writes", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
