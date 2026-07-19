import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(
    process.cwd(),
    "supabase/migrations/20260719150000_wa_end_of_shift_reconciliation.sql",
  ),
  "utf8",
).toLowerCase();

describe("WhatsApp end-of-shift reconciliation", () => {
  it("captures the canonical accounting equation and exception snapshot", () => {
    expect(sql).toContain("potential_received = converted + active_pending + explicitly_closed");
    expect(sql).toContain("unaccounted_potential_orders");
    expect(sql).toContain("derived_breach_intakes");
    expect(sql).toContain("overdue_intakes");
    expect(sql).toContain("control_gap_intakes");
    expect(sql).toContain("total_exception_intakes");
  });

  it("derives clean versus exception-present status from current controls", () => {
    expect(sql).toContain("reconciliation_status in ('clean', 'exceptions_present')");
    expect(sql).toContain("v_control.unaccounted_potential_orders = 0");
    expect(sql).toContain("v_control.total_exception_intakes = 0");
    expect(sql).toContain("then 'clean'");
    expect(sql).toContain("else 'exceptions_present'");
  });

  it("creates immutable end-of-shift evidence", () => {
    expect(sql).toContain("is append-only");
    expect(sql).toContain("before update or delete");
    expect(sql).toContain("recorded_by_user_id uuid not null");
    expect(sql).toContain("recorded_at timestamptz not null default now()");
  });

  it("prevents spoofed direct writes and authorizes snapshot capture", () => {
    expect(sql).toContain("security definer");
    expect(sql).toContain("not public.is_whatsapp_inbox_reader(v_actor)");
    expect(sql).toContain("revoke all on public.whatsapp_business_intake_shift_reconciliations from authenticated");
    expect(sql).toContain("grant select on public.whatsapp_business_intake_shift_reconciliations to authenticated");
    expect(sql).toContain("grant execute on function public.capture_whatsapp_business_intake_shift_reconciliation(text, text) to authenticated");
  });

  it("takes its values from the governed read-only control surface", () => {
    expect(sql).toContain("from public.whatsapp_business_intake_reconciliation_control");
    expect(sql).toContain("into strict v_control");
  });

  it("does not mutate intake or protected operational truth", () => {
    expect(sql).not.toMatch(/update\s+public\.whatsapp_business_intakes/);
    expect(sql).not.toMatch(/delete\s+from\s+public\.whatsapp_business_intakes/);
    expect(sql).not.toMatch(/insert\s+into\s+public\.whatsapp_business_intakes/);
    expect(sql).not.toMatch(/\b(orders|order_items|finance|dispatch|inventory|payments|invoices)\b[^\n]*\b(insert|update|delete)\b/);
  });
});
