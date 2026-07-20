import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720230000_wa_zero_loss_operations_summary.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss operations summary migration", () => {
  const sql = readMigration();

  it("consolidates the four operator attention dimensions over the unified queue", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("is_pending_breach");
    expect(sql).toContain("is_stale_pending");
    expect(sql).toContain("has_transition_integrity_exception");
    expect(sql).toContain("is_historical_repair_candidate");
  });

  it("counts each attention item once even when multiple dimensions apply", () => {
    expect(sql).toContain("unique_attention_item_count");
    expect(sql).toMatch(/count\(\*\) filter \(\s*where is_pending_breach\s*or is_stale_pending\s*or has_transition_integrity_exception\s*or is_historical_repair_candidate/s);
    expect(sql).not.toContain("pending_breach_count + stale_pending_count");
  });

  it("fails closed on nullable or unsupported dispositions and preserves closure evidence checks", () => {
    expect(sql).toContain("q.effective_disposition is null");
    expect(sql).toContain("q.effective_disposition not in ('ACTIVE_PENDING', 'EXPLICITLY_CLOSED')");
    expect(sql).toContain("q.effective_disposition = 'EXPLICITLY_CLOSED' and q.resolved_at is null");
    expect(sql).toContain("q.effective_disposition = 'EXPLICITLY_CLOSED' and nullif(btrim(q.closure_reason), '') is null");
  });

  it("uses underlying historical evidence rather than queue wrapper metadata", () => {
    expect(sql).toContain("q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by'");
    expect(sql).toContain("q.item_source = 'HISTORICAL_RECONCILIATION'");
  });

  it("validates stale thresholds and restricts execution to inbox readers", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_zero_loss_operations_summary(interval) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_zero_loss_operations_summary(interval) to authenticated",
    );
  });

  it("does not mutate source or downstream operational truth", () => {
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
      for (const verb of ["insert\\s+into", "update", "delete\\s+from", "truncate", "merge\\s+into"]) {
        expect(sql).not.toMatch(new RegExp(`${verb}\\s+(?:public\\.)?${table}`, "i"));
      }
    }
  });
});
