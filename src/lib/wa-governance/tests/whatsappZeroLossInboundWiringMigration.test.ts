import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260718190000_wa_zero_loss_inbound_wiring.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss inbound wiring migration", () => {
  const sql = readMigration();

  it("traces to the canonical governance documents and foundation migration", () => {
    expect(sql).toContain("docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md");
    expect(sql).toContain("docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md");
    expect(sql).toContain("20260718173000_wa_zero_loss_intake_foundation.sql");
  });

  it("enforces exactly one intake per durable source message and tolerates any unique duplicate", () => {
    expect(sql).toContain("whatsapp_business_intakes_source_message_unique");
    expect(sql).toContain("on conflict do nothing");
    expect(sql).not.toContain("on conflict (source_message_id)");
  });

  it("captures only inbound whatsapp_messages rows", () => {
    expect(sql).toContain("after insert on public.whatsapp_messages");
    expect(sql).toContain("new.direction is distinct from 'inbound'");
  });

  it("keeps every captured message active, owned, and actionable", () => {
    expect(sql).toContain("'ACTIVE_PENDING'");
    expect(sql).toContain("'WHATSAPP_INTAKE'");
    expect(sql).toContain("inferred_next_action");
    expect(sql).toContain("'ACCOUNTED'");
  });

  it("persists the identity triad without inventing a commercial customer", () => {
    expect(sql).toContain("'identity_triad'");
    expect(sql).toContain("'submitting_sender_contact_id', new.contact_id");
    expect(sql).toContain("'original_communicator_contact_id', new.contact_id");
    expect(sql).toContain("'original_communicator_state'");
    expect(sql).toContain("'commercial_customer_id', null");
    expect(sql).toContain("'commercial_customer_state', 'UNRESOLVED'");
  });

  it("treats order-like text as a potential order", () => {
    expect(sql).toContain("inferred_kind := 'POTENTIAL_ORDER'");
    expect(sql).toContain("inferred_state := 'RECEIVED'");
  });

  it("preserves media as unresolved risk until classification", () => {
    expect(sql).toContain("inferred_kind := 'UNRESOLVED_RISK'");
    expect(sql).toContain("inferred_state := 'AWAITING_CLASSIFICATION'");
    expect(sql).toContain("Inspect inbound media and classify all business intents");
  });

  it("retains non-order business messages for governed classification", () => {
    expect(sql).toContain("inferred_kind := 'NON_ORDER_BUSINESS'");
    expect(sql).toContain("Classify inbound WhatsApp message and route every identified business intent");
  });

  it("writes an append-only audit event for each new intake", () => {
    expect(sql).toContain("whatsapp_business_intake_audit_log");
    expect(sql).toContain("'INBOUND_CAPTURED'");
  });

  it("does not expose the security-definer trigger function for direct invocation", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain("revoke all on function public.capture_whatsapp_business_intake_from_message() from public");
    expect(sql).toContain("revoke all on function public.capture_whatsapp_business_intake_from_message() from anon");
    expect(sql).toContain("revoke all on function public.capture_whatsapp_business_intake_from_message() from authenticated");
  });

  it("never writes executable order, finance, dispatch, or inventory rows", () => {
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
