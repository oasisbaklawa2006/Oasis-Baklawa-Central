import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720082000_wa_authorized_channel_accountability_queue.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel accountability queue migration", () => {
  const sql = readMigration();

  it("unifies current capture exceptions and immutable historical reconciliation", () => {
    expect(sql).toContain("whatsapp_channel_intake_exceptions");
    expect(sql).toContain("whatsapp_authorized_channel_history_accountability");
    expect(sql).toContain("CURRENT_CAPTURE_EXCEPTION");
    expect(sql).toContain("HISTORICAL_RECONCILIATION");
    expect(sql).toContain("union all");
  });

  it("preserves source lineage, ownership, next action, closure reason, and evidence", () => {
    for (const field of [
      "source_message_id",
      "existing_intake_id",
      "provider_message_id",
      "receiver_channel_id",
      "assigned_team",
      "effective_next_action",
      "closure_reason",
      "evidence",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("is read-only, security-invoker, and restricted to authenticated inbox readers", () => {
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on public.whatsapp_authorized_channel_accountability_queue from public, anon",
    );
    expect(sql).toContain(
      "grant select on public.whatsapp_authorized_channel_accountability_queue to authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_authorized_channel_accountability_queue(boolean, integer) to authenticated",
    );
  });

  it("defaults to active pending work and provides deterministic priority ordering", () => {
    expect(sql).toContain("include_closed boolean default false");
    expect(sql).toContain("q.effective_disposition = 'ACTIVE_PENDING'");
    expect(sql).toContain("q.priority_rank asc");
    expect(sql).toContain("q.detected_at asc");
    expect(sql).toContain("q.source_message_id asc");
  });

  it("ranks every unresolved current exception ahead of closed evidence", () => {
    expect(sql).toContain("when e.disposition = 'ACTIVE_PENDING' then 80");
    expect(sql).toMatch(
      /when e\.disposition = 'ACTIVE_PENDING' then 80\s+else 90\s+end as priority_rank/i,
    );
    expect(sql).toContain("when h.effective_disposition <> 'ACTIVE_PENDING' then 90");
  });

  it("bounds result size and rejects invalid limits", () => {
    expect(sql).toContain("result_limit integer default 200");
    expect(sql).toContain("result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("limit result_limit");
  });

  it("does not write operational or source truth", () => {
    for (const table of [
      "whatsapp_messages",
      "whatsapp_business_intakes",
      "orders",
      "order_items",
      "sales_order_drafts",
      "sales_order_draft_lines",
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
