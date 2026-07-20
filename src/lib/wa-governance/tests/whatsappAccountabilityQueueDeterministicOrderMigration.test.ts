import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720171000_wa_accountability_queue_deterministic_order.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp accountability queue deterministic-order forward repair", () => {
  const sql = readMigration();

  it("preserves pending-only default filtering and bounded result validation", () => {
    expect(sql).toContain("include_closed or q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("result_limit is null or result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("limit result_limit");
  });

  it("uses guaranteed lineage tiebreakers after nullable source-message ordering", () => {
    expect(sql).toContain("q.source_message_id asc nulls last");
    expect(sql).toContain("q.item_source asc");
    expect(sql).toContain("q.source_record_id asc");
    expect(sql.indexOf("q.item_source asc")).toBeGreaterThan(
      sql.indexOf("q.source_message_id asc nulls last"),
    );
    expect(sql.indexOf("q.source_record_id asc")).toBeGreaterThan(
      sql.indexOf("q.item_source asc"),
    );
  });

  it("retains inbox-reader authorization and authenticated-only execution", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) to authenticated",
    );
  });

  it("does not mutate accountability, source, order, finance, inventory, invoice, or dispatch truth", () => {
    for (const table of [
      "whatsapp_authorized_channel_accountability_queue",
      "whatsapp_channel_intake_exceptions",
      "whatsapp_authorized_channel_history_accountability",
      "whatsapp_messages",
      "whatsapp_business_intakes",
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
      expect(sql).not.toMatch(
        new RegExp(`truncate\\s+(?:table\\s+)?(?:public\\.)?${table}`, "i"),
      );
      expect(sql).not.toMatch(new RegExp(`merge\\s+into\\s+(?:public\\.)?${table}`, "i"));
    }
  });
});
