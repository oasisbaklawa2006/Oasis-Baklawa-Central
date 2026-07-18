import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260718173000_wa_zero_loss_intake_foundation.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss intake migration", () => {
  const sql = readMigration();

  it("fixes the business domain to B2B", () => {
    expect(sql).toContain("business_domain text not null default 'B2B'");
    expect(sql).toContain("check (business_domain = 'B2B')");
  });

  it("requires durable source evidence", () => {
    expect(sql).toContain("whatsapp_business_intakes_source_present");
    expect(sql).toMatch(/packet_id is not null or source_message_id is not null or provider_message_id is not null/);
  });

  it("requires every intake to have an owner or governed queue", () => {
    expect(sql).toContain("whatsapp_business_intakes_owner_present");
    expect(sql).toMatch(/assigned_user_id is not null or assigned_team is not null or escalation_owner_user_id is not null/);
  });

  it("requires an active next action", () => {
    expect(sql).toContain("whatsapp_business_intakes_pending_next_action");
    expect(sql).toContain("disposition <> 'ACTIVE_PENDING' or next_action is not null");
  });

  it("prevents converted intake without a governed order link", () => {
    expect(sql).toContain("whatsapp_business_intakes_converted_link");
    expect(sql).toMatch(/sales_order_draft_id is not null or sales_order_id is not null/);
  });

  it("prevents silent closure", () => {
    expect(sql).toContain("whatsapp_business_intakes_closed_fields");
    expect(sql).toMatch(/closure_reason is not null/);
    expect(sql).toMatch(/closed_by_user_id is not null/);
    expect(sql).toMatch(/closed_at is not null/);
  });

  it("keeps lifecycle and disposition aligned", () => {
    expect(sql).toContain("whatsapp_business_intakes_state_disposition_match");
    expect(sql).toContain("lifecycle_state = 'CONVERTED_TO_SO' and disposition = 'CONVERTED'");
    expect(sql).toContain("lifecycle_state = 'EXPLICITLY_CLOSED' and disposition = 'EXPLICITLY_CLOSED'");
  });

  it("makes the audit log append-only", () => {
    expect(sql).toContain("whatsapp_business_intake_audit_log");
    expect(sql).toContain("before update or delete on public.whatsapp_business_intake_audit_log");
    expect(sql).toContain("is append-only");
  });

  it("keeps RLS restricted to authenticated team members", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("public.is_team_member(auth.uid())");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/with check\s*\(\s*true\s*\)/i);
  });

  it("defines the reconciliation equation and zero-loss metric", () => {
    expect(sql).toContain("whatsapp_business_intake_reconciliation");
    expect(sql).toContain("potential_received");
    expect(sql).toContain("converted");
    expect(sql).toContain("active_pending");
    expect(sql).toContain("explicitly_closed");
    expect(sql).toContain("unaccounted_potential_orders");
  });

  it("does not alter or write executable order rows", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.orders/i);
    expect(sql).not.toMatch(/update\s+public\.orders/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.orders/i);
    expect(sql).not.toMatch(/insert\s+into\s+public\.order_items/i);
    expect(sql).not.toMatch(/update\s+public\.order_items/i);
    expect(sql).not.toMatch(/delete\s+from\s+public\.order_items/i);
  });
});
