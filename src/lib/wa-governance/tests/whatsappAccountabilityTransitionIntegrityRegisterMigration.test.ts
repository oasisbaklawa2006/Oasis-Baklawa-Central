import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720213000_wa_accountability_transition_integrity_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp accountability transition integrity register migration", () => {
  const sql = readMigration();

  it("reads the unified accountability queue and returns each offending item once with all codes", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("integrity_codes text[]");
    expect(sql).toContain("array_remove(array[");
    expect(sql).toContain("cardinality(c.integrity_codes) > 0");
  });

  it("detects illegal, contradictory pending, closure, and governed-accounted evidence", () => {
    for (const code of [
      "ILLEGAL_DISPOSITION",
      "PENDING_WITH_RESOLVED_AT",
      "PENDING_WITH_CLOSURE_REASON",
      "CLOSED_WITHOUT_RESOLVED_AT",
      "CLOSED_WITHOUT_REASON",
      "GOVERNED_ACCOUNTED_NOT_TERMINAL",
    ]) {
      expect(sql).toContain(code);
    }
    expect(sql).toContain("q.effective_disposition is null");
    expect(sql).toContain("q.accountability_state is distinct from 'AUTHORIZED_ACCOUNTED'");
    expect(sql).toContain("q.effective_disposition is distinct from 'EXPLICITLY_CLOSED'");
  });

  it("preserves ownership, next action, closure, resolution, evidence, and source lineage", () => {
    for (const field of [
      "item_source",
      "source_record_id",
      "source_message_id",
      "existing_intake_id",
      "provider_message_id",
      "receiver_channel_id",
      "assigned_team",
      "effective_next_action",
      "closure_reason",
      "detected_at",
      "resolved_at",
      "evidence",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("uses deterministic bounded ordering", () => {
    expect(sql).toContain("result_limit integer default 200");
    expect(sql).toContain("result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("c.detected_at asc");
    expect(sql).toContain("c.item_source asc");
    expect(sql).toContain("c.source_record_id asc");
    expect(sql).toContain("limit result_limit");
  });

  it("restricts access to authenticated inbox readers", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_accountability_transition_integrity_exceptions(integer) to authenticated",
    );
  });

  it("does not write source or downstream operational truth", () => {
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
      for (const operation of ["insert\\s+into", "update", "delete\\s+from", "truncate", "merge\\s+into"]) {
        expect(sql).not.toMatch(new RegExp(`${operation}\\s+(?:public\\.)?${table}`, "i"));
      }
    }
  });
});
