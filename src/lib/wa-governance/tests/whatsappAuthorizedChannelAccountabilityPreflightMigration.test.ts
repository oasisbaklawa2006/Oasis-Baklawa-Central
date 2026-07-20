import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720100000_wa_authorized_channel_accountability_preflight.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel accountability preflight migration", () => {
  const sql = readMigration();

  it("reads only active pending records from the unified accountability queue", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
  });

  it("detects critical, unowned, actionless, and stale records", () => {
    expect(sql).toContain("priority_rank <= 20");
    expect(sql).toContain("nullif(btrim(assigned_team), '') is null");
    expect(sql).toContain("nullif(btrim(effective_next_action), '') is null");
    expect(sql).toContain("detected_at <= statement_timestamp() - stale_after");
  });

  it("defines the programme breach metric from missing ownership or next action", () => {
    expect(sql).toContain("invariant_breach_count");
    expect(sql).toContain("metric_is_zero");
    expect(sql).toContain("(c.unowned_count + c.actionless_count) = 0");
  });

  it("rejects invalid stale thresholds and restricts reads to inbox readers", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_preflight(interval) to authenticated",
    );
  });

  it("does not write source, order, finance, inventory, invoice, or dispatch truth", () => {
    for (const table of [
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
    }
  });
});
