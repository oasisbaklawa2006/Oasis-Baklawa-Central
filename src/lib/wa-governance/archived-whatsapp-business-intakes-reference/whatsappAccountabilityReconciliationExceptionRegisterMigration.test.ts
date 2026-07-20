import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720173500_wa_accountability_reconciliation_exception_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp accountability reconciliation exception register migration", () => {
  const sql = readMigration();

  it("surfaces one traceable row with all applicable exception codes", () => {
    expect(sql).toContain("array_remove(array[");
    expect(sql).toContain("'ILLEGAL_DISPOSITION'");
    expect(sql).toContain("'MISSING_OWNER'");
    expect(sql).toContain("'MISSING_NEXT_ACTION'");
    expect(sql).toContain("'MISSING_CLOSURE_REASON'");
    expect(sql).toContain("where cardinality(e.exception_codes) > 0");
  });

  it("treats null and unsupported non-governed dispositions as illegal", () => {
    expect(sql).toContain("c.effective_disposition is null");
    expect(sql).toContain(
      "c.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')",
    );
  });

  it("preserves source lineage and deterministic bounded ordering", () => {
    for (const field of [
      "e.item_source",
      "e.source_record_id",
      "e.source_message_id",
      "e.existing_intake_id",
      "e.provider_message_id",
      "e.receiver_channel_id",
    ]) {
      expect(sql).toContain(field);
    }
    expect(sql).toContain("e.item_source asc");
    expect(sql).toContain("e.source_record_id asc");
    expect(sql).toContain("limit result_limit");
  });

  it("does not treat governed historical items as reconciliation exceptions", () => {
    expect(sql).toContain("q.accountability_state = 'AUTHORIZED_ACCOUNTED'");
    expect(sql).toContain("not c.is_governed_accounted");
  });

  it("validates stale thresholds, limits, and inbox-reader authorization", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("result_limit is null or result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("e.detected_at <= statement_timestamp() - stale_after as is_stale");
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
