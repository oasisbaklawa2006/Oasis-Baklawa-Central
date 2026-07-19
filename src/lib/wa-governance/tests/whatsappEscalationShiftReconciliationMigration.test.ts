import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260719170000_wa_escalation_and_shift_reconciliation.sql"),
  "utf8",
).toLowerCase();

describe("WhatsApp escalation and shift reconciliation", () => {
  it("creates one governed open escalation per intake with ownership lineage", () => {
    expect(sql).toContain("create table public.whatsapp_business_intake_escalations");
    expect(sql).toContain("one_open_per_intake");
    expect(sql).toContain("from_owner_user_id");
    expect(sql).toContain("to_owner_user_id");
    expect(sql).toContain("escalated_by_user_id");
  });

  it("transfers active-pending ownership and appends audit evidence", () => {
    expect(sql).toContain("where id = p_intake_id and disposition = 'active_pending'");
    expect(sql).toContain("set escalation_owner_user_id = p_to_owner_user_id");
    expect(sql).toContain("assigned_user_id = p_to_owner_user_id");
    expect(sql).toContain("'escalated'");
    expect(sql).toContain("whatsapp_business_intake_audit_log");
  });

  it("requires a balanced zero-loss equation and clean supervisor sign-off", () => {
    expect(sql).toContain("potential_received = converted + active_pending + explicitly_closed");
    expect(sql).toContain("signoff_status <> 'signed_off' or (unaccounted_potential_orders = 0 and open_escalations = 0)");
    expect(sql).toContain("supervisor_user_id is not null");
    expect(sql).toContain("nullif(btrim(supervisor_note), '') is not null");
  });

  it("preserves authorization and RLS boundaries", () => {
    expect(sql).toContain("enable row level security");
    expect(sql).toContain("public.is_whatsapp_inbox_reader(auth.uid())");
    expect(sql).toContain("security invoker");
    expect(sql).toContain("revoke all on function public.escalate_whatsapp_business_intake");
    expect(sql).toContain("with (security_invoker = true)");
  });

  it("does not mutate protected downstream domains", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.(orders|order_items|payments|invoices|inventory|dispatch)/);
    expect(sql).not.toMatch(/update\s+public\.(orders|order_items|payments|invoices|inventory|dispatch)/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.(orders|order_items|payments|invoices|inventory|dispatch)/);
  });
});
