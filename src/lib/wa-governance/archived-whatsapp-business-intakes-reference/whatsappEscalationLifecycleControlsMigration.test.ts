import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/archived-migrations/whatsapp-business-intakes-undelivered/20260719193000_wa_escalation_lifecycle_controls.sql"),
  "utf8",
).toLowerCase();

describe("WhatsApp escalation lifecycle controls", () => {
  it("makes acknowledgement owner-only and idempotent", () => {
    expect(sql).toContain("create or replace function public.acknowledge_whatsapp_business_intake_escalation");
    expect(sql).toContain("only the assigned escalation owner may acknowledge");
    expect(sql).toContain("if v_acknowledged_by = v_actor then");
    expect(sql).toContain("return;");
  });

  it("requires acknowledgement and an active-pending intake before resolution", () => {
    expect(sql).toContain("escalation must be acknowledged before resolution");
    expect(sql).toContain("disposition = 'active_pending'");
    expect(sql).toContain("resolution note is required");
    expect(sql).toContain("only the escalation owner or escalator may resolve");
  });

  it("uses row locks and stale-state race guards", () => {
    expect(sql.match(/for update;/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain("acknowledgement lost a concurrent race");
    expect(sql).toContain("resolution lost a concurrent race");
    expect(sql).toContain("where id = p_escalation_id and resolved_at is null");
  });

  it("appends immutable intake audit evidence", () => {
    expect(sql).toContain("whatsapp_business_intake_audit_log");
    expect(sql).toContain("'escalation_acknowledged'");
    expect(sql).toContain("'escalation_resolved'");
    expect(sql).toContain("resolution_note");
  });

  it("restricts execution and avoids protected downstream writes", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("set search_path = public, pg_temp");
    expect(sql).toContain("revoke all on function public.acknowledge_whatsapp_business_intake_escalation");
    expect(sql).toContain("revoke all on function public.resolve_whatsapp_business_intake_escalation");
    expect(sql).not.toMatch(/(insert into|update|delete from)\s+public\.(orders|order_items|payments|invoices|inventory|dispatch)/);
  });
});
