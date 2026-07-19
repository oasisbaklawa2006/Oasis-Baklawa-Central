import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719170000_wa_clarification_answer_rpc_authority.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp clarification answer RPC authority hardening", () => {
  it("restores only the governed answer function as security definer", () => {
    expect(sql).toContain(
      "alter function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb)",
    );
    expect(sql).toContain("security definer");
    expect(sql).not.toContain("grant update on public.whatsapp_business_intake_clarifications");
    expect(sql).not.toContain("grant insert on public.whatsapp_business_intake_clarifications");
    expect(sql).not.toContain("grant delete on public.whatsapp_business_intake_clarifications");
  });

  it("keeps execution restricted to authenticated callers", () => {
    expect(sql).toContain(
      "revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from public",
    );
    expect(sql).toContain(
      "revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from anon",
    );
    expect(sql).toContain(
      "grant execute on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) to authenticated",
    );
  });

  it("does not cross protected downstream boundaries", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
