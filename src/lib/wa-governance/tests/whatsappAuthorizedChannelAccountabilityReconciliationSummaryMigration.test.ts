import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720164000_wa_authorized_channel_accountability_reconciliation_summary.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel accountability reconciliation summary migration", () => {
  const sql = readMigration();

  it("balances every accountability item into governed, pending, or explicitly closed", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("q.accountability_state = 'AUTHORIZED_ACCOUNTED'");
    expect(sql).toContain("effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("effective_disposition = 'EXPLICITLY_CLOSED'");
    expect(sql).toContain("c.received = c.governed_accounted + c.active_pending + c.explicitly_closed");
  });

  it("does not misclassify governed historical items as reasonless closures", () => {
    expect(sql).toContain("and not is_governed_accounted");
    expect(sql).toContain("governed_accounted_count");
    expect(sql).toContain("closure_without_reason_count");
  });

  it("counts each pending accountability breach once even when both obligations are missing", () => {
    expect(sql).toContain("missing_owner or missing_next_action");
    expect(sql).toContain("unique_unaccounted_count");
    expect(sql).not.toContain("pending_without_owner + pending_without_next_action");
  });

  it("requires ownership, a next action, and a recorded closure reason for a zero metric", () => {
    expect(sql).toContain("nullif(btrim(q.assigned_team), '') is null");
    expect(sql).toContain("nullif(btrim(q.effective_next_action), '') is null");
    expect(sql).toContain("nullif(btrim(q.closure_reason), '') is null");
    expect(sql).toContain("c.unique_unaccounted = 0");
    expect(sql).toContain("c.closure_without_reason = 0");
  });

  it("restricts reads to authenticated WhatsApp inbox readers", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_reconciliation_summary() to authenticated",
    );
  });

  it("does not mutate source, order, finance, inventory, invoice, or dispatch truth", () => {
    for (const table of [
      "whatsapp_authorized_channel_accountability_queue",
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
