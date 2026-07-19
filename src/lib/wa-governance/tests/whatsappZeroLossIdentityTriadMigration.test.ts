import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260719040000_wa_zero_loss_identity_triad.sql",
);
const sql = readFileSync(migrationPath, "utf8");
const normalized = sql.toLowerCase();

describe("WhatsApp zero-loss identity triad migration", () => {
  it("persists the three identities separately", () => {
    expect(normalized).toContain("submitting_sender_contact_id");
    expect(normalized).toContain("submitting_sender_user_id");
    expect(normalized).toContain("original_communicator_contact_id");
    expect(normalized).toContain("original_communicator_user_id");
    expect(normalized).toContain("commercial_customer_id");
    expect(normalized).toContain("identity_resolution_status");
  });

  it("does not permit contact and internal-user identities to collapse together", () => {
    expect(normalized).toContain("whatsapp_business_intakes_submitter_identity_shape");
    expect(normalized).toContain("whatsapp_business_intakes_original_communicator_identity_shape");
    expect(normalized).toContain("submitting sender must be either a contact or an internal user");
    expect(normalized).toContain("original communicator must be either a contact or an internal user");
  });

  it("requires the complete triad and evidence before resolved status", () => {
    expect(normalized).toContain("whatsapp_business_intakes_identity_resolution_match");
    expect(normalized).toContain("identity_resolution_status <> 'resolved'");
    expect(normalized).toContain("commercial_customer_id is not null");
    expect(normalized).toContain("nullif(btrim(identity_resolution_note), '') is not null");
  });

  it("hydrates durable inbound identity metadata only after UUID-shape validation", () => {
    expect(normalized).toContain("hydrate_whatsapp_business_intake_identity_triad");
    expect(normalized).toContain("before insert on public.whatsapp_business_intakes");
    expect(normalized).toContain("submitter_contact_text::uuid");
    expect(normalized).toContain("original_contact_text::uuid");
    expect(normalized).toContain("customer_text::uuid");
    expect(normalized).toContain("~* '^[0-9a-f]{8}-");
  });

  it("uses an authorized, row-locked, audit-appending resolution RPC", () => {
    expect(normalized).toContain("resolve_whatsapp_business_intake_identity");
    expect(normalized).toContain("public.is_whatsapp_inbox_reader(actor_id)");
    expect(normalized).toContain("for update");
    expect(normalized).toContain("terminal intake identity cannot be changed");
    expect(normalized).toContain("identity_triad_resolved");
    expect(normalized).toContain("whatsapp_business_intake_audit_log");
  });

  it("keeps unresolved identity visible and actionable", () => {
    expect(normalized).toContain("then 'awaiting_customer'");
    expect(normalized).toContain(
      "resolve submitting sender, original communicator, and commercial customer before order readiness.",
    );
    expect(normalized).toContain("identity_resolution_status in ('unresolved', 'partial', 'resolved')");
  });

  it("preserves the Central boundary and contains no executable downstream writes", () => {
    expect(normalized).toContain("docs/whatsapp_canonical_intent_and_zero_loss_governance.md");
    expect(normalized).not.toMatch(/insert\s+into\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(normalized).not.toMatch(/update\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(normalized).not.toMatch(/delete\s+from\s+public\.(orders|order_items|sales_order_drafts)/);
    expect(normalized).not.toMatch(/\b(finance|dispatch|inventory)\b[^\n]*\b(insert|update|delete)\b/);
  });

  it("keeps the RPC unavailable to public and anonymous roles", () => {
    expect(normalized).toContain(
      "revoke all on function public.resolve_whatsapp_business_intake_identity",
    );
    expect(normalized).toContain("from public");
    expect(normalized).toContain("from anon");
    expect(normalized).toContain("grant execute on function public.resolve_whatsapp_business_intake_identity");
    expect(normalized).toContain("to authenticated");
  });
});