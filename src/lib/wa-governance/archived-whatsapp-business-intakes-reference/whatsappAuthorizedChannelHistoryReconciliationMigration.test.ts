import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH =
  "supabase/migrations/20260720030000_wa_authorized_channel_history_reconciliation.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel history reconciliation migration", () => {
  const sql = readMigration();

  it("fails closed until the active official B2B allow-list is populated", () => {
    expect(sql).toContain("whatsapp_authorized_business_channels");
    expect(sql).toContain("where c.business_domain = 'B2B'");
    expect(sql).toContain("and c.is_active");
    expect(sql).toContain(
      "Populate and verify the active official B2B WhatsApp receiver allow-list before historical reconciliation",
    );
  });

  it("classifies every durable inbound message against receiver authorization and intake lineage", () => {
    expect(sql).toContain("from public.whatsapp_messages wm");
    expect(sql).toContain("left join public.whatsapp_business_intakes wbi");
    expect(sql).toContain("extract_whatsapp_receiver_channel_id");
    expect(sql).toContain("'AUTHORIZED_ACCOUNTED'");
    expect(sql).toContain("'AUTHORIZED_CAPTURE_GAP'");
    expect(sql).toContain("'RECEIVER_ID_MISSING'");
    expect(sql).toContain("'CHANNEL_UNAUTHORIZED'");
    expect(sql).toContain("'AUTHORIZATION_CONFLICT'");
  });

  it("is idempotent by durable source-message identity", () => {
    expect(sql).toContain("unique (source_message_id)");
    expect(sql).toContain("on conflict (source_message_id) do nothing");
    expect(sql).toContain("get diagnostics inserted_count = row_count");
  });

  it("preserves historical source truth and records immutable evidence", () => {
    expect(sql).toContain("historical_truth_mutated', false");
    expect(sql).toContain("is append-only");
    expect(sql).toContain("before update or delete");

    for (const table of ["whatsapp_messages", "whatsapp_business_intakes", "debug_webhooks"]) {
      expect(sql).not.toMatch(new RegExp(`update\\s+(?:public\\.)?${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`delete\\s+from\\s+(?:public\\.)?${table}`, "i"));
    }
  });

  it("keeps all unresolved history visible, owned, and actionable", () => {
    expect(sql).toContain("'ACTIVE_PENDING'");
    expect(sql).toContain("'WHATSAPP_CHANNEL_GOVERNANCE'");
    expect(sql).toContain("next_action text not null");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("whatsapp_authorized_channel_history_accountability");
    expect(sql).toContain("effective_disposition");
    expect(sql).toContain("effective_next_action");
  });

  it("supports explicit reasoned closure without mutating reconciliation evidence", () => {
    expect(sql).toContain("whatsapp_authorized_channel_history_resolution");
    expect(sql).toContain("resolution_reason text not null");
    expect(sql).toContain("length(btrim(resolution_reason)) > 0");
    expect(sql).toContain("close_whatsapp_authorized_channel_history_item");
    expect(sql).toContain("A recorded closure reason is required");
    expect(sql).toContain("on conflict (reconciliation_id) do nothing");
    expect(sql).toContain("when resolution.id is not null then 'EXPLICITLY_CLOSED'");
    expect(sql).toContain("whatsapp_authorized_channel_history_resolution is append-only");
  });

  it("restricts reconciliation and closure execution to the protected service boundary", () => {
    expect(sql).toContain(
      "revoke all on function public.reconcile_whatsapp_authorized_channel_history() from public",
    );
    expect(sql).toContain(
      "revoke all on function public.reconcile_whatsapp_authorized_channel_history() from anon",
    );
    expect(sql).toContain(
      "revoke all on function public.reconcile_whatsapp_authorized_channel_history() from authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.reconcile_whatsapp_authorized_channel_history() to service_role",
    );
    expect(sql).toContain(
      "revoke all on function public.close_whatsapp_authorized_channel_history_item(uuid, text, jsonb, uuid) from authenticated",
    );
    expect(sql).toContain(
      "grant execute on function public.close_whatsapp_authorized_channel_history_item(uuid, text, jsonb, uuid) to service_role",
    );
  });

  it("does not write operational downstream truth", () => {
    for (const table of [
      "orders",
      "order_items",
      "sales_order_drafts",
      "sales_order_draft_lines",
      "payments",
      "invoices",
      "dispatches",
      "inventory",
    ]) {
      expect(sql).not.toMatch(new RegExp(`insert\\s+into\\s+public\\.${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`update\\s+public\\.${table}`, "i"));
      expect(sql).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${table}`, "i"));
    }
  });
});