import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720201500_wa_null_governed_state_classification_repair.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp nullable governed-state classification repair migration", () => {
  const sql = readMigration();

  it("repairs both reconciliation summary and exception register", () => {
    expect(sql).toContain(
      "get_whatsapp_authorized_channel_accountability_reconciliation_summary",
    );
    expect(sql).toContain(
      "get_whatsapp_authorized_channel_accountability_reconciliation_exceptions",
    );
  });

  it("fails closed when governed-accounted classification is false or null", () => {
    expect(sql).toContain("is_governed_accounted is not true");
    expect(sql).toContain("is_governed_accounted is true");
    expect(sql).not.toMatch(/\band not is_governed_accounted\b/i);
    expect(sql).not.toMatch(/\bwhen not c\.is_governed_accounted\b/i);
  });

  it("preserves pending, closure, and illegal-disposition exception coverage", () => {
    expect(sql).toContain("effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("effective_disposition = 'EXPLICITLY_CLOSED'");
    expect(sql).toContain("effective_disposition is null");
    expect(sql).toContain(
      "effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')",
    );
    expect(sql).toContain("'ILLEGAL_DISPOSITION'");
    expect(sql).toContain("'MISSING_OWNER'");
    expect(sql).toContain("'MISSING_NEXT_ACTION'");
    expect(sql).toContain("'MISSING_CLOSURE_REASON'");
  });

  it("preserves unique pending breach counting and zero-metric gates", () => {
    expect(sql).toContain("and (missing_owner or missing_next_action)");
    expect(sql).toContain("c.unique_unaccounted = 0");
    expect(sql).toContain("c.closure_without_reason = 0");
  });

  it("preserves authorization, bounded reads, and deterministic ordering", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("e.item_source asc");
    expect(sql).toContain("e.source_record_id asc");
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_exceptions(interval, integer) to authenticated",
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
