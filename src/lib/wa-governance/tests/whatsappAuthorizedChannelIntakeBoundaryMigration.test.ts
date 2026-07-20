import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const MIGRATION_PATH = "supabase/migrations/20260720023000_wa_authorized_channel_intake_boundary.sql";

function readMigration(): string {
  return readFileSync(join(REPO_ROOT, MIGRATION_PATH), "utf8");
}

describe("WhatsApp authorized-channel intake boundary migration", () => {
  const sql = readMigration();

  it("requires an explicit active B2B receiver allow-list entry", () => {
    expect(sql).toContain("whatsapp_authorized_business_channels");
    expect(sql).toContain("receiver_channel_id");
    expect(sql).toContain("business_domain = 'B2B'");
    expect(sql).toContain("and c.is_active");
  });

  it("derives Meta receiving phone-number identity from durable raw webhook evidence", () => {
    expect(sql).toContain("extract_whatsapp_receiver_channel_id");
    expect(sql).toContain("{entry,0,changes,0,value,metadata,phone_number_id}");
    expect(sql).toContain("where dw.wamid = new.provider_message_id");
  });

  it("fails closed without silently losing missing or unauthorized channels", () => {
    expect(sql).toContain("whatsapp_channel_intake_exceptions");
    expect(sql).toContain("'RECEIVER_ID_MISSING'");
    expect(sql).toContain("'CHANNEL_UNAUTHORIZED'");
    expect(sql).toContain("'ACTIVE_PENDING'");
    expect(sql).toContain("'WHATSAPP_CHANNEL_GOVERNANCE'");
    expect(sql).toContain("return new;");
  });

  it("creates B2B governed intake only after channel authorization", () => {
    const authorizationGuard = sql.indexOf("if not channel_is_authorized then");
    const businessInsert = sql.indexOf("insert into public.whatsapp_business_intakes");
    expect(authorizationGuard).toBeGreaterThan(-1);
    expect(businessInsert).toBeGreaterThan(authorizationGuard);
    expect(sql).toContain("'authorized_receiver_channel_id', receiver_channel_id");
  });

  it("keeps channel registry and exception ledgers read-only to normal users", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_authorized_business_channels",
    );
    expect(sql).toContain(
      "revoke insert, update, delete, truncate on public.whatsapp_channel_intake_exceptions",
    );
  });

  it("preserves the security-definer trigger boundary", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toContain(
      "revoke all on function public.capture_whatsapp_business_intake_from_message() from public",
    );
    expect(sql).toContain(
      "revoke all on function public.capture_whatsapp_business_intake_from_message() from anon",
    );
    expect(sql).toContain(
      "revoke all on function public.capture_whatsapp_business_intake_from_message() from authenticated",
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
