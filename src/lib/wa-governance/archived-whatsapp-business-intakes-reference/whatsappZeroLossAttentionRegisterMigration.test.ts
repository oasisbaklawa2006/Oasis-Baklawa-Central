import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260720231500_wa_zero_loss_attention_register.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss attention register migration", () => {
  const sql = readMigration();

  it("returns every attention item once with all applicable reason codes", () => {
    expect(sql).toContain("array_remove(array[");
    expect(sql).toContain("attention_codes");
    expect(sql).toContain("where cardinality(c.attention_codes) > 0");
  });

  it("includes pending ownership, next-action, and stale reasons", () => {
    expect(sql).toContain("'MISSING_OWNER'");
    expect(sql).toContain("'MISSING_NEXT_ACTION'");
    expect(sql).toContain("'STALE_PENDING'");
    expect(sql).toContain("statement_timestamp() - stale_after");
  });

  it("includes fail-closed transition integrity reasons", () => {
    for (const code of [
      "ILLEGAL_DISPOSITION",
      "PENDING_WITH_RESOLVED_AT",
      "PENDING_WITH_CLOSURE_REASON",
      "CLOSED_WITHOUT_RESOLVED_AT",
      "CLOSED_WITHOUT_REASON",
      "GOVERNED_ACCOUNTED_NOT_TERMINAL",
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain("q.effective_disposition is null");
    expect(sql).toContain("is distinct from 'EXPLICITLY_CLOSED'");
  });

  it("includes historical lineage and durable-evidence repair reasons", () => {
    for (const code of [
      "MISSING_SOURCE_MESSAGE_ID",
      "MISSING_PROVIDER_MESSAGE_ID",
      "MISSING_RECEIVER_CHANNEL_ID",
      "MISSING_ACCOUNTABILITY_STATE",
      "MISSING_EVIDENCE",
      "GOVERNED_ACCOUNTED_WITHOUT_INTAKE_LINK",
    ]) {
      expect(sql).toContain(`'${code}'`);
    }
    expect(sql).toContain("q.item_source = 'HISTORICAL_RECONCILIATION'");
    expect(sql).toContain("q.evidence - 'resolution_id' - 'resolution_evidence' - 'resolved_by'");
  });

  it("validates inputs, authorization, and deterministic bounded ordering", () => {
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("stale_after is null or stale_after <= interval '0 seconds'");
    expect(sql).toContain("result_limit is null or result_limit < 1 or result_limit > 1000");
    expect(sql).toContain("c.priority_rank asc");
    expect(sql).toContain("c.item_source asc");
    expect(sql).toContain("c.source_record_id asc");
    expect(sql).toContain("limit result_limit");
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
