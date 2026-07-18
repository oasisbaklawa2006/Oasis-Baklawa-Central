import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260718193000_wa_zero_loss_operator_queue.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp zero-loss operator queue migration", () => {
  const sql = readMigration();

  it("traces to canonical governance authority and both foundation migrations", () => {
    expect(sql).toContain("branch: docs/whatsapp-intent-zero-loss-governance");
    expect(sql).toContain("commit: d8000bad8bed157ed8f44a02a59d4677ca32c1b8");
    expect(sql).toContain("docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md");
    expect(sql).toContain("docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md");
    expect(sql).toContain("20260718173000_wa_zero_loss_intake_foundation.sql");
    expect(sql).toContain("20260718190000_wa_zero_loss_inbound_wiring.sql");
  });

  it("creates a security-invoker read-only operator view", () => {
    expect(sql).toContain("create or replace view public.whatsapp_business_intake_operator_queue");
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).toContain("grant select on public.whatsapp_business_intake_operator_queue to authenticated");
    expect(sql).toContain("revoke all on public.whatsapp_business_intake_operator_queue from anon");
  });

  it("preserves governed source evidence under RLS before packet stitching", () => {
    expect(sql).toContain("create policy whatsapp_messages_governed_intake_reader_select");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("where i.source_message_id = whatsapp_messages.id");
    expect(sql).toContain("and i.business_domain = 'B2B'");
    expect(sql).not.toContain("packet_id is not null");
  });

  it("joins governed intake to durable source evidence", () => {
    expect(sql).toContain("from public.whatsapp_business_intakes i");
    expect(sql).toContain("left join public.whatsapp_messages m");
    expect(sql).toContain("on m.id = i.source_message_id");
    expect(sql).toContain("m.content as message_content");
    expect(sql).toContain("m.media_url");
  });

  it("surfaces ownership, next action, SLA, reconciliation, and identity metadata", () => {
    for (const field of [
      "assigned_user_id",
      "assigned_team",
      "escalation_owner_user_id",
      "next_action",
      "sla_due_at",
      "reconciliation_status",
      "reconciliation_issue",
      "metadata",
      "age_seconds",
      "is_overdue",
    ]) {
      expect(sql).toContain(field);
    }
  });

  it("remains fixed to the B2B domain", () => {
    expect(sql).toContain("where i.business_domain = 'B2B'");
  });

  it("does not write lifecycle or executable business rows", () => {
    expect(sql).not.toMatch(/insert\s+into/i);
    expect(sql).not.toMatch(/update\s+public\./i);
    expect(sql).not.toMatch(/delete\s+from/i);
  });
});