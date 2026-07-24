import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719101500_wa_so_readiness_lineage.sql"),
  "utf8",
).toLowerCase();

describe("WhatsApp SO readiness lineage", () => {
  it("preserves exact source, customer and identity lineage", () => {
    expect(sql).toContain("create table public.whatsapp_so_readiness_lineage");
    expect(sql).toContain("source_packet_mismatch");
    expect(sql).toContain("identity_triad_unresolved");
    expect(sql).toContain("original_communicator_required");
    expect(sql).toContain("customer_lineage_mismatch");
  });

  it("blocks readiness while governed work remains unresolved", () => {
    expect(sql).toContain("open_clarification");
    expect(sql).toContain("unresolved_multimodal_work");
    expect(sql).toContain("unresolved_routed_intent");
    expect(sql).toContain("draft_readiness_incomplete");
    expect(sql).toContain("resolve every recorded so-readiness blocker");
  });

  it("is authorized, owned, idempotent and auditable", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(sql).toContain("so readiness work must retain an owner");
    expect(sql).toContain("on conflict(intake_id,sales_order_draft_id) do update");
    expect(sql).toContain("so_readiness_evaluated");
    expect(sql).toContain("revoke insert,update,delete,truncate");
  });

  it("locks the intake before the draft to preserve a consistent order", () => {
    const intakeLock = sql.indexOf("from public.whatsapp_business_intakes");
    const draftLock = sql.indexOf("from public.sales_order_drafts", intakeLock);
    expect(intakeLock).toBeGreaterThan(-1);
    expect(draftLock).toBeGreaterThan(intakeLock);
  });

  it("does not create or mutate live operational truth", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items)/);
    expect(sql).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
