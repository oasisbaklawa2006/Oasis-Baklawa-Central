import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719061500_wa_zero_loss_formal_clarification_rpc_security.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp clarification RPC security hardening", () => {
  it("routes writes through checked definer functions while preserving read-only table access", () => {
    expect(sql).toContain(
      "alter function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz)",
    );
    expect(sql).toContain(
      "alter function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb)",
    );
    expect(sql.match(/security definer/g) ?? []).toHaveLength(2);
    expect(sql).toContain("direct table mutation remains unavailable");
  });
});
