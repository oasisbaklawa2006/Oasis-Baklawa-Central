import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720203000_wa_stale_accountability_escalation_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp stale accountability escalation register migration", () => {
  const sql = readMigration();

  it("selects every stale active-pending accountability item", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain(
      "q.detected_at <= statement_timestamp() - stale_after",
    );
  });

  it("preserves ownership, next action, age, evidence, and unique lineage", () => {
    expect(sql).toContain("q.assigned_team");
    expect(sql).toContain("q.effective_next_action");
    expect(sql).toContain("statement_timestamp() - q.detected_at as age");
    expect(sql).toContain("q.evidence");
    expect(sql).toContain("q.item_source");
    expect(sql).toContain("q.source_record_id");
  });

  it("does not hide owned and actionable stale work", () => {
    expect(sql).not.toMatch(
      /where[\s\S]*nullif\(btrim\(q\.assigned_team\), ''\) is null[\s\S]*limit result_limit/i,
    );
    expect(sql).not.toMatch(
      /where[\s\S]*nullif\(btrim\(q\.effective_next_action\), ''\) is null[\s\S]*limit result_limit/i,
    );
  });

  it("validates threshold and result bounds", () => {
    expect(sql).toContain(
      "stale_after is null or stale_after <= interval '0 seconds'",
    );
    expect(sql).toContain("result_limit < 1 or result_limit > 1000");
  });

  it("orders oldest first with deterministic lineage tiebreakers", () => {
    expect(sql).toContain("q.detected_at asc");
    expect(sql).toContain("q.priority_rank asc");
    expect(sql).toContain("q.item_source asc");
    expect(sql).toContain("q.source_record_id asc");
  });

  it("restricts execution to authenticated inbox readers", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_stale_accountability_escalations(interval, integer) to authenticated",
    );
  });

  it("does not mutate source or operational truth", () => {
    for (const table of [
      "whatsapp_messages",
      "whatsapp_business_intakes",
      "whatsapp_authorized_channel_accountability_queue",
      "orders",
      "order_items",
      "sales_order_drafts",
      "payments",
      "invoices",
      "dispatches",
      "inventory",
    ]) {
      expect(sql).not.toMatch(new RegExp(`insert\\s+into\\s+(?:public\\.)?${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`update\\s+(?:public\\.)?${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`delete\\s+from\\s+(?:public\\.)?${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`truncate\\s+(?:table\\s+)?(?:public\\.)?${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`merge\\s+into\\s+(?:public\\.)?${table}`, "i"));
    }
  });
});
