import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720184500_wa_accountability_reconciliation_parity.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp accountability reconciliation parity migration", () => {
  const sql = readMigration();

  it("compares the reconciliation summary against independently classified queue evidence", () => {
    expect(sql).toContain(
      "public.get_whatsapp_authorized_channel_accountability_reconciliation_summary()",
    );
    expect(sql).toContain("public.whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("summary_equation_mismatch_count");
    expect(sql).toContain("classified_illegal_disposition_count");
    expect(sql).toContain("summary_unique_unaccounted_count");
    expect(sql).toContain("classified_unique_pending_breach_count");
    expect(sql).toContain("summary_closure_without_reason_count");
    expect(sql).toContain("classified_closure_reason_breach_count");
  });

  it("classifies null and unsupported non-governed dispositions as equation exceptions", () => {
    expect(sql).toContain("effective_disposition is null");
    expect(sql).toContain(
      "effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')",
    );
    expect(sql).toContain("not is_governed_accounted");
  });

  it("counts each pending ownership or action breach once", () => {
    expect(sql).toContain("missing_owner or missing_next_action");
    expect(sql).toContain("unique_pending_breach_count");
    expect(sql).not.toContain("missing_owner + missing_next_action");
  });

  it("requires exact count parity across every reconciliation obligation", () => {
    expect(sql).toContain(
      "s.equation_mismatch_count = c.illegal_disposition_count",
    );
    expect(sql).toContain(
      "s.unique_unaccounted_count = c.unique_pending_breach_count",
    );
    expect(sql).toContain(
      "s.closure_without_reason_count = c.closure_reason_breach_count",
    );
    expect(sql).toContain("parity_is_zero");
  });

  it("restricts reads to authenticated WhatsApp inbox readers", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_parity() to authenticated",
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
