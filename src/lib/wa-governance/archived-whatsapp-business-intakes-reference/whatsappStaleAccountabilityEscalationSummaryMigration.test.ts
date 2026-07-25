import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720223000_wa_stale_accountability_escalation_summary.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp stale accountability escalation summary migration", () => {
  const sql = readMigration();

  it("summarizes only stale active-pending accountability items", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("q.detected_at <= statement_timestamp() - stale_after");
  });

  it("separates unique accountability breaches from owned actionable stalled work", () => {
    expect(sql).toContain("count(*) filter (where missing_owner or missing_next_action)");
    expect(sql).toContain("count(*) filter (where not missing_owner and not missing_next_action)");
    expect(sql).not.toContain("unowned_stale_count + actionless_stale_count");
  });

  it("reports critical and oldest stale-work signals", () => {
    expect(sql).toContain("priority_rank <= 20");
    expect(sql).toContain("min(detected_at) as oldest_detected_at");
    expect(sql).toContain("statement_timestamp() - c.oldest_detected_at");
    expect(sql).toContain("c.stale_count = 0 as stale_queue_is_zero");
  });

  it("fails closed for invalid thresholds and unauthorized readers", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_stale_accountability_summary(interval) to authenticated",
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
