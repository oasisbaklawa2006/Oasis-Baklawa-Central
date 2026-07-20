import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720152000_wa_authorized_channel_accountability_breach_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel accountability breach register migration", () => {
  const sql = readMigration();

  it("returns only uniquely unaccounted active pending records", () => {
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("nullif(btrim(q.assigned_team), '') is null");
    expect(sql).toContain("nullif(btrim(q.effective_next_action), '') is null");
    expect(sql).toContain("or nullif(btrim(q.effective_next_action), '') is null");
    expect(sql).not.toContain("unowned_count + actionless_count");
  });

  it("preserves source lineage and exposes breach reasons", () => {
    for (const field of [
      "item_source",
      "source_record_id",
      "source_message_id",
      "existing_intake_id",
      "provider_message_id",
      "receiver_channel_id",
      "missing_owner",
      "missing_next_action",
      "evidence",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("provides bounded deterministic stale-first ordering", () => {
    expect(sql).toContain("stale_after must be greater than zero");
    expect(sql).toContain("result_limit must be between 1 and 1000");
    expect(sql).toContain("q.detected_at <= statement_timestamp() - stale_after as is_stale");
    expect(sql).toContain("q.priority_rank asc");
    expect(sql).toContain("q.detected_at asc");
    expect(sql).toContain("limit result_limit");
  });

  it("restricts access to authenticated WhatsApp inbox readers", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_breach_register(interval, integer) to authenticated",
    );
  });

  it("does not mutate operational or system-of-record truth", () => {
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
