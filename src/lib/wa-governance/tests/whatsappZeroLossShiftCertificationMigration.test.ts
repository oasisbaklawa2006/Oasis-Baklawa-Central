import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260721053000_wa_zero_loss_shift_certification.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss shift certification migration", () => {
  const sql = readMigration();

  it("derives certification from the consolidated operations summary", () => {
    expect(sql).toContain("get_whatsapp_zero_loss_operations_summary(stale_after)");
    expect(sql).toContain("s.unique_attention_item_count as unaccounted_potential_orders");
    expect(sql).toContain("s.zero_loss_operations_clear as zero_loss_certified");
  });

  it("emits explicit certified and attention-required states", () => {
    expect(sql).toContain("CERTIFIED_ZERO_LOSS");
    expect(sql).toContain("NOT_CERTIFIED_ATTENTION_REQUIRED");
    expect(sql).toContain("statement_timestamp() as certified_at");
  });

  it("fails closed for invalid thresholds and unauthorized callers", () => {
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("grant execute on function public.get_whatsapp_zero_loss_shift_certification(interval) to authenticated");
  });

  it("does not mutate operational truth", () => {
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
      for (const verb of ["insert\\s+into", "update", "delete\\s+from", "truncate", "merge\\s+into"]) {
        expect(sql).not.toMatch(new RegExp(`${verb}\\s+(?:public\\.)?${table}`, "i"));
      }
    }
  });
});
