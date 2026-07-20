import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260718200000_wa_zero_loss_lifecycle_actions.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss lifecycle actions migration", () => {
  const sql = readMigration();

  it("anchors to canonical governance and prior zero-loss migrations", () => {
    expect(sql).toContain("docs/whatsapp-intent-zero-loss-governance");
    expect(sql).toContain("d8000bad8bed157ed8f44a02a59d4677ca32c1b8");
    expect(sql).toContain("docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md");
    expect(sql).toContain("20260718173000_wa_zero_loss_intake_foundation.sql");
    expect(sql).toContain("20260718190000_wa_zero_loss_inbound_wiring.sql");
    expect(sql).toContain("20260718193000_wa_zero_loss_operator_queue.sql");
  });

  it("authorizes only authenticated WhatsApp inbox readers", () => {
    expect(sql).toContain("auth.uid() is null or not public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("revoke all on function public.transition_whatsapp_business_intake");
    expect(sql).toContain("from anon");
    expect(sql).toContain("grant execute on function public.transition_whatsapp_business_intake");
    expect(sql).toContain("to authenticated");
  });

  it("locks the intake row before validating and mutating it", () => {
    expect(sql).toContain("for update");
    expect(sql).toContain("where id = p_intake_id");
    expect(sql).toContain("business_domain = 'B2B'");
  });

  it("refuses executable conversion states", () => {
    expect(sql).not.toContain("'SALES_ORDER_DRAFT_CREATED',");
    expect(sql).not.toContain("'CONVERTED_TO_SO',");
    expect(sql).toContain("unsupported target lifecycle state");
  });

  it("prevents transitions from terminal records", () => {
    expect(sql).toContain("current_row.disposition in ('CONVERTED', 'EXPLICITLY_CLOSED')");
    expect(sql).toContain("terminal WhatsApp business intake cannot be transitioned");
  });

  it("requires retained ownership and an effective next action for pending work", () => {
    expect(sql).toContain("an active intake must retain an owner");
    expect(sql).toContain("effective_next_action := coalesce(");
    expect(sql).toContain("nullif(btrim(p_next_action), '')");
    expect(sql).toContain("nullif(btrim(current_row.next_action), '')");
    expect(sql).toContain("next action is required for an active intake");
    expect(sql).toContain("target_disposition := 'ACTIVE_PENDING'");
  });

  it("requires explicit closure reason and records the authenticated actor", () => {
    expect(sql).toContain("closure reason is required");
    expect(sql).toContain("target_disposition := 'EXPLICITLY_CLOSED'");
    expect(sql).toContain("closed_by_user_id = case when target_disposition = 'EXPLICITLY_CLOSED' then auth.uid()");
    expect(sql).toContain("closed_at = case when target_disposition = 'EXPLICITLY_CLOSED' then now()");
  });

  it("appends a complete lifecycle audit event", () => {
    expect(sql).toContain("insert into public.whatsapp_business_intake_audit_log");
    expect(sql).toContain("'LIFECYCLE_TRANSITIONED'");
    expect(sql).toContain("'EXPLICITLY_CLOSED'");
    expect(sql).toContain("'from_lifecycle_state'");
    expect(sql).toContain("'to_lifecycle_state'");
    expect(sql).toContain("'previous_next_action'");
    expect(sql).toContain("'next_action'");
    expect(sql).toContain("'closure_reason'");
  });

  it("never creates executable order, finance, dispatch, or inventory rows", () => {
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