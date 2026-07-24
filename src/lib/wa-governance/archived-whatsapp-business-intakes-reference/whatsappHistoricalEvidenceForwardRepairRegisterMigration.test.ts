import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720214500_wa_historical_evidence_forward_repair_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp historical evidence forward-repair register migration", () => {
  const sql = readMigration();

  it("limits diagnostics to historical reconciliation items", () => {
    expect(sql).toContain("whatsapp_authorized_channel_accountability_queue");
    expect(sql).toContain("q.item_source = 'HISTORICAL_RECONCILIATION'");
  });

  it("detects missing lineage, channel, state, evidence, and governed intake linkage", () => {
    for (const code of [
      "MISSING_SOURCE_MESSAGE_ID",
      "MISSING_PROVIDER_MESSAGE_ID",
      "MISSING_RECEIVER_CHANNEL_ID",
      "MISSING_ACCOUNTABILITY_STATE",
      "MISSING_EVIDENCE",
      "GOVERNED_ACCOUNTED_WITHOUT_INTAKE_LINK",
    ]) {
      expect(sql).toContain(code);
    }
    expect(sql).toContain(
      "(q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by') = '{}'::jsonb",
    );
    expect(sql).not.toContain("q.evidence = '{}'::jsonb then 'MISSING_EVIDENCE'");
    expect(sql).toContain("q.existing_intake_id is null");
  });

  it("returns each repair candidate once with all applicable codes and operational context", () => {
    expect(sql).toContain("repair_codes text[]");
    expect(sql).toContain("array_remove(array[");
    expect(sql).toContain("cardinality(c.repair_codes) > 0");
    for (const field of [
      "source_record_id",
      "source_message_id",
      "existing_intake_id",
      "provider_message_id",
      "receiver_channel_id",
      "accountability_state",
      "effective_disposition",
      "assigned_team",
      "effective_next_action",
      "detected_at",
      "evidence",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("prioritizes rows with more missing evidence and uses deterministic bounded ordering", () => {
    expect(sql).toContain("result_limit integer default 200");
    expect(sql).toContain("result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("cardinality(c.repair_codes) desc");
    expect(sql).toContain("c.detected_at asc");
    expect(sql).toContain("c.source_record_id asc");
    expect(sql).toContain("limit result_limit");
  });

  it("restricts access to authenticated inbox readers", () => {
    expect(sql).toContain("security invoker");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke all on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) from public",
    );
    expect(sql).toContain(
      "grant execute on function public.get_whatsapp_historical_evidence_forward_repair_register(integer) to authenticated",
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
